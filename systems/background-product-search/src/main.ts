import * as crypto from 'node:crypto';
import { Readable } from 'node:stream';

import Fastify from 'fastify';
import hashObject from 'hash-object';

import {
  closeBrowser,
  closePage,
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
      search: { keyword: string; source: PRODUCT_SOURCE };
      taskId: string;
    };
    const database = createDatabaseConnection();
    const taskState = connectTaskStateOnDatabase(database, payload.taskId);
    const lock = connectLockHandlerOnDatabase(database, requestId);
    if (await lock.checkRequestLockExist()) {
      logger.info('Request already processed');
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
    const browser = await createChromiumBrowser();
    const productDetailScheduler = createProductDetailScheduler(cloudTask);
    async function* createSearchGenerator() {
      const searchCache = connectProductSearchCacheOnDatabase(
        database,
        search.source,
        cacheKey,
      );
      const cachedSearchItems = await searchCache.getCachedSearchData();
      if (cachedSearchItems.ok) {
        yield* Object.entries(cachedSearchItems.data).map(item => ({
          ...item,
          cached: true,
        }));
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
        const page = await createBrowserPage(browser)();
        const productModules = {
          [PRODUCT_SOURCE.OCADO]: sainsbury,
          [PRODUCT_SOURCE.SAINSBURY]: ocado,
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
      requestProcessor.on('end', () => {
        closeBrowser(browser);
      });

      for await (const [productId, productInfo] of requestProcessor) {
        const { productUrl, source } = productInfo;
        matchedProducts.push([productId, productInfo]);
        await productDetailScheduler.scheduleProductDetailTask({
          product: {
            productId,
            productUrl,
            source,
          },
          requestId: requestId,
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
        dbBatch.set(searchCache.cachedSearch, {
          expiresAt: Timestamp.fromDate(
            // 3 days
            new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
          ),
          hits: Object.fromEntries(matchedProducts),
        });
      }

      dbBatch.set(replyStream.getRepliesStreamDoc(search.source), {
        data: { total: numberOfProducts },
        search: search,
        type: SUBTASK_RELY_DATA_TYPE.SEARCH_PRODUCT,
      });
      dbBatch.set(taskState.taskState, {
        markedAt: Timestamp.now(),
        state: TASK_STATE.DONE,
      });
      dbBatch.delete(lock.lock);
      await dbBatch.commit();
      logger.info('Product search completed', {
        numberOfProducts,
        source: search.source,
      });
      reply.code(204).send('204 No Content');
    } catch (e) {
      if (error.isNativeError(e)) {
        logger.error(e.message, {
          e,
        });
        if (!error.isHTTPError(e)) {
          const dbBatch = database.batch();
          dbBatch.set(replyStream.getRepliesStreamDoc(search.source), {
            error: {
              code: e['code'] ?? 'ERR_UNEXPECTED_ERROR',
              message: e.message,
            },
            search: search,
            type: SUBTASK_RELY_DATA_TYPE.SEARCH_PRODUCT_ERROR,
          });
          dbBatch.delete(lock.lock);
          await dbBatch.commit();
          reply.code(500).send(e.message);
        } else {
          const dbBatch = database.batch();
          if (!e.http.retryAble) {
            dbBatch.set(replyStream.getRepliesStreamDoc(search.source), {
              error: {
                code: e['code'] ?? 'ERR_UNEXPECTED_ERROR',
                message: e.message,
              },
              search: search,
              type: SUBTASK_RELY_DATA_TYPE.SEARCH_PRODUCT_ERROR,
            });
            dbBatch.set(taskState.taskState, {
              markedAt: Timestamp.now(),
              state: TASK_STATE.ERROR,
            });
          }
          dbBatch.delete(lock.lock);
          await dbBatch.commit();
          reply.code(e.http.statusCode).send(e.http.message);
        }
      }
    }
  },
  schema: {
    body: {
      properties: {
        search: {
          properties: {
            keyword: { type: 'string' },
            source: { enum: Object.values(PRODUCT_SOURCE), type: 'string' },
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
    const taskState = connectTaskStateOnDatabase(database, payload.taskId);
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
    const cloudTask = createCloudTaskClient();
    const subTaskScheduler = createProductSearchSubTaskScheduler(
      cloudTask,
      host!,
    );
    await subTaskReplyStream.init();
    await subTaskScheduler.scheduleProductSearchSubTask({
      requestId: subTaskRequestId,
      search: {
        keyword: payload.search.keyword,
        source: PRODUCT_SOURCE.OCADO,
      },
    });
    // await subTaskScheduler.scheduleProductSearchSubTask({
    //   requestId: subTaskRequestId,
    //   search: {
    //     keyword: payload.search.keyword,
    //     source: PRODUCT_SOURCE.SAINSBURY,
    //   },
    // });
    await Readable.from(subTaskReplyStream.subscribe()).toArray();
    const totalCount = await subTaskReplyStream.totalSearchMatchCount;
    const batch = database.batch();
    if (totalCount && totalCount !== 0) {
      batch.set(replyStream.stream, {
        data: { total: totalCount },
        search: payload.search,
        type: REPLY_DATA_TYPE.SEARCH_PRODUCT,
      });
      batch.set(taskState.taskState, {
        markedAt: Timestamp.now(),
        state: TASK_STATE.DONE,
      });
    } else {
      batch.set(replyStream.stream, {
        error: {
          code: 'ERR_NO_SEARCH_RESULT',
          message: 'No search result',
        },
        search: payload.search,
        type: REPLY_DATA_TYPE.SEARCH_PRODUCT_ERROR,
      });
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

fastify.post('/token-bucket/refill', async (req, reply) => {
  const logger = req.log;
  const tokenBucket = connectTokenBucketOnDatabase(createDatabaseConnection());
  await tokenBucket.refill(PRODUCT_SOURCE.OCADO);
  await tokenBucket.refill(PRODUCT_SOURCE.SAINSBURY);
  logger.info('Token bucket has been refilled');
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
