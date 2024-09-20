import * as crypto from 'node:crypto';
import { Readable } from 'node:stream';

import Fastify from 'fastify';
import hashObject from 'hash-object';

import {
  closeBrowser,
  closePage,
  createAntiDetectionChromiumBrowser,
  createBrowserPage,
  createChromiumBrowser,
} from '@/browser.ts';
import {
  createCloudTaskClient,
  createProductDetailScheduler,
  createProductSearchSubTaskScheduler,
  TASK_STATE,
} from '@/cloud-task.ts';
import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import {
  connectLockHandlerOnDatabase,
  connectProductSearchCacheOnDatabase,
  connectReplyStreamOnDatabase,
  connectTaskStateOnDatabase,
  connectTokenBucketOnDatabase,
  connectToProductSearchSubTasksReplyStreamOnDatabase,
  createDatabaseConnection,
  databaseHealthCheck,
  Timestamp,
} from '@/database.ts';
import * as error from '@/error.ts';
import { adaptToFastifyLogger, createLogger } from '@/logger.ts';
import * as sainsbury from '@/sainsbury.ts';
import {
  PRODUCT_SOURCE,
  REPLY_DATA_TYPE,
  SUBTASK_RELY_DATA_TYPE,
} from '@/types.ts';

import * as ocado from './ocado.ts';

const config = loadConfig(APP_ENV);

const fastify = Fastify({
  // We are using Winston for logging and fastify wasn't able to customize the request object on log
  disableRequestLogging: true,
  genReqId() {
    return crypto.randomUUID();
  },
  logger: adaptToFastifyLogger(createLogger(APP_ENV)),
  requestIdHeader: 'request-id',
  requestIdLogLabel: 'requestId',
});

fastify.get('/health', async (_, reply) => {
  const database = createDatabaseConnection();
  const [databaseHealthCheckResult] = await Promise.all([
    databaseHealthCheck(database)(),
  ]);
  const info = [
    ['database', databaseHealthCheckResult.ok ? { ok: true } : null],
  ].filter(([, result]) => result);
  const errors = [
    [
      'database',
      databaseHealthCheckResult.ok ? null : databaseHealthCheckResult.error,
    ],
  ].filter(([, error]) => error);
  const ok = errors.length === 0;
  const healthCheckResult = {
    errors: Object.fromEntries(errors),
    info: Object.fromEntries(info),
    ok,
  };
  if (!healthCheckResult.ok) {
    reply.code(503).send(JSON.stringify(healthCheckResult));
    return;
  }
  reply.code(200);
});

fastify.post(`/search`, {
  // eslint-disable-next-line max-statements
  async handler(req, reply) {
    const requestId = req.id;
    const logger = req.log;
    const payload = req.body as {
      parentRequestId: string;
      search: {
        keyword: string;
        source: PRODUCT_SOURCE;
      };
      taskId: string;
    };
    const database = createDatabaseConnection();
    const taskState = connectTaskStateOnDatabase(
      database,
      requestId,
      payload.taskId,
    );
    const lock = connectLockHandlerOnDatabase(database, requestId);
    if (await lock.checkRequestLockExist()) {
      reply.code(409).send('409 Conflict');
      return;
    }
    if (!(await taskState.shouldTaskRun())) {
      logger.error("Task already done or shouldn't retry");
      reply.code(208).send('208 Already Reported');
      return;
    }
    const cloudTask = createCloudTaskClient();
    const replyStream = connectToProductSearchSubTasksReplyStreamOnDatabase(
      database,
      requestId,
    );
    await lock.acquireLock();
    const search = payload.search;
    const cacheKey = hashObject(search);
    const productDetailScheduler = createProductDetailScheduler(cloudTask);
    async function* createSearchGenerator() {
      const searchCache = connectProductSearchCacheOnDatabase(
        database,
        search.source,
        cacheKey,
      );
      const cachedSearchItems = await searchCache.getCachedSearchData();
      if (cachedSearchItems.ok) {
        yield* cachedSearchItems.data;
      } else {
        const tokenBucket = connectTokenBucketOnDatabase(database);
        if (!(await tokenBucket.consume(search.source)).ok) {
          throw error.withHTTPError(
            429,
            'Rate limit exceeded',
          )(
            error.withErrorCode('ERR_RATE_LIMIT_EXCEEDED')(
              new Error('Rate limit exceeded'),
            ),
          );
        }
        const browser =
          search.source === PRODUCT_SOURCE.SAINSBURY
            ? await createAntiDetectionChromiumBrowser()
            : await createChromiumBrowser();

        const page = await createBrowserPage(browser)();
        const productModules = {
          [PRODUCT_SOURCE.OCADO]: ocado,
          [PRODUCT_SOURCE.SAINSBURY]: sainsbury,
        };
        const generator = productModules[
          search.source
        ].createProductsSearchHandler(page, {
          logger,
        })(search.keyword);
        try {
          yield* generator;
        } finally {
          await closePage(page);
          await closeBrowser(browser);
        }
      }
    }
    try {
      const matchedProducts: Array<
        [
          string,
          { cached?: boolean; productUrl: string; source: PRODUCT_SOURCE },
        ]
      > = [];
      const requestProcessor = Readable.from(createSearchGenerator());

      for await (const [productId, productInfo] of requestProcessor) {
        const { productUrl, source } = productInfo;
        matchedProducts.push([productId, productInfo]);
        await productDetailScheduler.scheduleProductDetailTask({
          product: {
            productId,
            productUrl,
            source,
          },
          requestId: payload.parentRequestId,
        });
      }
      const numberOfProducts = matchedProducts.length;

      const dbBatch = database.batch();
      const isCached = matchedProducts.some(
        ([, productInfo]) => productInfo.cached === true,
      );
      if (!isCached && matchedProducts.length > 0) {
        const searchCache = connectProductSearchCacheOnDatabase(
          database,
          search.source,
          cacheKey,
        );
        dbBatch.set(
          searchCache.cachedSearch,
          searchCache.shapeOfCachedProduct(matchedProducts),
        );
      }

      dbBatch.set(
        replyStream.getRepliesStreamDoc(search.source),
        replyStream.shapeOfReplyStreamItem({
          data: { total: numberOfProducts },
          type: SUBTASK_RELY_DATA_TYPE.SEARCH_PRODUCT,
        }),
      );
      dbBatch.set(
        taskState.taskState,
        taskState.shapeOfTaskStateObject(TASK_STATE.DONE),
      );
      dbBatch.delete(lock.lock);
      await dbBatch.commit();
      logger.info(`Product search of ${search.source} completed`, {
        keyword: payload.search.keyword,
        numberOfProducts,
        source: search.source,
      });
      reply.code(204).send('204 No Content');
    } catch (e) {
      logger.error(`Product search of ${search.source} failed`, {
        error: Object.assign(
          {
            code: error.isNativeError(e) ? e.code : 'ERR_UNEXPECTED_ERROR',
            message: error.isNativeError(e) ? e.message : 'Unknown error',
          },
          error.isNativeError(e) && e['code'] ? {} : { raw: e },
        ),
        payload: req.body,
      });
      const dbBatch = database.batch();
      if (!error.isHTTPError(e)) {
        dbBatch.set(
          replyStream.getRepliesStreamDoc(search.source),
          replyStream.shapeOfReplyStreamItem({
            error: {
              code: error.isNativeError(e) ? e['code'] : 'ERR_UNEXPECTED_ERROR',
              message: error.isNativeError(e) ? e['message'] : 'Unknown error',
            },
            type: SUBTASK_RELY_DATA_TYPE.SEARCH_PRODUCT_ERROR,
          }),
        );
        dbBatch.set(
          taskState.taskState,
          taskState.shapeOfTaskStateObject(TASK_STATE.ERROR),
        );
      } else {
        const dbBatch = database.batch();
        if (!e.http.retryAble) {
          dbBatch.set(
            replyStream.getRepliesStreamDoc(search.source),
            replyStream.shapeOfReplyStreamItem({
              error: {
                code: e['code'] ?? 'ERR_UNEXPECTED_ERROR',
                message: e.message,
              },
              type: SUBTASK_RELY_DATA_TYPE.SEARCH_PRODUCT_ERROR,
            }),
          );
          dbBatch.set(
            taskState.taskState,
            taskState.shapeOfTaskStateObject(TASK_STATE.ERROR),
          );
        }
      }
      dbBatch.delete(lock.lock);
      await dbBatch.commit();
      if (error.isHTTPError(e)) {
        reply.code(e.http.statusCode).send(e.http.message);
      } else {
        reply.code(500).send('500 Internal Server Error');
      }
    }
  },
  schema: {
    body: {
      properties: {
        parentRequestId: { type: 'string' },
        search: {
          properties: {
            keyword: { type: 'string' },
            source: { enum: Object.values(PRODUCT_SOURCE), type: 'string' },
          },
          required: ['keyword', 'source'],
          type: 'object',
        },
        taskId: { type: 'string' },
      },
      required: ['search', 'taskId'],
      type: 'object',
    },
    headers: {
      properties: {
        'request-id': { type: 'string' },
      },
      required: ['request-id'],
      type: 'object',
    },
  },
});

fastify.post('/', {
  // eslint-disable-next-line max-statements
  async handler(req, reply) {
    const requestId = req.id;
    const logger = req.log;
    const payload = req.body as { search: { keyword: string }; taskId: string };
    const host = req.headers.host;
    if (!host) {
      logger.error('Host header is missing');
      reply.code(400).send('400 Bad Request');
      return;
    }
    const database = createDatabaseConnection();
    const taskState = connectTaskStateOnDatabase(
      database,
      requestId,
      payload.taskId,
    );
    if (!(await taskState.shouldTaskRun())) {
      logger.error("Task already done or shouldn't retry");
      reply.code(208).send('208 Already Reported');
      return;
    }
    const lock = connectLockHandlerOnDatabase(database, requestId);
    if (await lock.checkRequestLockExist()) {
      logger.info('Request already processed');
      reply.code(409).send('409 Conflict');
      return;
    }
    const replyStream = connectReplyStreamOnDatabase(database, requestId);
    const subTaskRequestId = `${crypto.randomUUID()}-search-sub-tasks`;
    const subTaskReplyStream =
      connectToProductSearchSubTasksReplyStreamOnDatabase(
        database,
        subTaskRequestId,
      );
    await lock.acquireLock();
    logger.info(`Start process product search of ${payload.search.keyword}`, {
      host,
      payload,
    });
    const cloudTask = createCloudTaskClient();
    const subTaskScheduler = createProductSearchSubTaskScheduler(
      cloudTask,
      host!,
    );
    await subTaskReplyStream.init();
    await subTaskScheduler.scheduleProductSearchSubTask({
      parentRequestId: requestId,
      requestId: subTaskRequestId,
      search: {
        keyword: payload.search.keyword,
        source: PRODUCT_SOURCE.OCADO,
      },
    });
    await subTaskScheduler.scheduleProductSearchSubTask({
      parentRequestId: requestId,
      requestId: subTaskRequestId,
      search: {
        keyword: payload.search.keyword,
        source: PRODUCT_SOURCE.SAINSBURY,
      },
    });
    const streamItems = await Readable.from(
      subTaskReplyStream.subscribe({
        numberOfSubTasksCreated: 2,
      }),
    ).toArray();
    const totalCount = await subTaskReplyStream.totalSearchMatchCount;
    const batch = database.batch();
    if (totalCount && totalCount !== 0) {
      batch.set(
        replyStream.stream,
        replyStream.shapeOfReplyStreamItem({
          data: { total: totalCount },
          type: REPLY_DATA_TYPE.SEARCH_PRODUCT,
        }),
      );
      batch.set(
        taskState.taskState,
        taskState.shapeOfTaskStateObject(TASK_STATE.DONE),
      );
    } else {
      logger.error('Error when searching the product, no search result', {
        streamItems,
        totalCount,
      });
      batch.set(
        replyStream.stream,
        replyStream.shapeOfReplyStreamItem({
          error: {
            code: 'ERR_NO_SEARCH_RESULT',
            message: 'No search result',
          },
          type: REPLY_DATA_TYPE.SEARCH_PRODUCT_ERROR,
        }),
      );
      batch.set(taskState.taskState, {
        markedAt: Timestamp.now(),
        state: TASK_STATE.ERROR,
      });
    }
    batch.delete(lock.lock);
    await batch.commit();
    await subTaskReplyStream.closeStream().catch(e => {
      logger.error('Error when closing the stream', {
        error: e,
      });
    });
    logger.info(`Completed product search of ${payload.search.keyword}`, {
      totalCount,
    });
    reply.code(204).send('204 No Content');
    return;
  },
  schema: {
    body: {
      properties: {
        search: {
          properties: {
            keyword: { type: 'string' },
          },
          required: ['keyword'],
          type: 'object',
        },
        taskId: { type: 'string' },
      },
      required: ['search', 'taskId'],
      type: 'object',
    },
    headers: {
      properties: {
        'request-id': { type: 'string' },
      },
      required: ['request-id'],
      type: 'object',
    },
  },
});

fastify.post('/token-bucket/refill', async (_, reply) => {
  const tokenBucket = connectTokenBucketOnDatabase(createDatabaseConnection());
  await tokenBucket.refill(PRODUCT_SOURCE.OCADO);
  await tokenBucket.refill(PRODUCT_SOURCE.SAINSBURY);
  reply.code(204).send('204 No Content');
});

fastify.listen(
  {
    host: '0.0.0.0',
    port: config.get('port'),
  },
  async (err, address) => {
    if (err) {
      fastify.log.error(err);
      throw err;
    }
    const logger = fastify.log;
    logger.info(`server listening on ${address}`);
    await fetch(`${address}/token-bucket/refill`, {
      method: 'POST',
    });
    if (APP_ENV === AppEnvironment.DEV) {
      setInterval(() => {
        fetch(`${address}/token-bucket/refill`, {
          method: 'POST',
        }).catch(e => {
          logger.error('Error when refill the bucket', {
            error: e,
          });
        });
      }, 60000);
    }
  },
);
