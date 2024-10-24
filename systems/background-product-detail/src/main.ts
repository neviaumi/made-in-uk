import Fastify from 'fastify';

import {
  createCloudTaskClient,
  createProductDetailSubTaskScheduler,
} from '@/cloud-task.ts';
import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import {
  connectProductCacheOnDatabase,
  connectReplyStreamOnDatabase,
  connectTaskStateOnDatabase,
  connectTokenBucketOnDatabase,
  createDatabaseConnection,
  createLockHandlerOnDatabase,
  databaseHealthCheck,
} from '@/database.ts';
import * as error from '@/error.ts';
import { adaptToFastifyLogger, createLogger } from '@/logger.ts';
import * as requestQueue from '@/request-queue.ts';
import { PRODUCT_SOURCE, REPLY_DATA_TYPE, TASK_STATE } from '@/types.ts';

const config = loadConfig(APP_ENV);

const fastify = Fastify({
  // We are using Winston for logging and fastify wasn't able to customize the request object on log
  disableRequestLogging: true,
  genReqId() {
    return crypto.randomUUID();
  },
  loggerInstance: adaptToFastifyLogger(createLogger(APP_ENV)),
  requestIdHeader: 'request-id',
  requestIdLogLabel: 'requestId',
});
fastify.get('/health', {
  async handler(_, reply) {
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
      reply.code(503).send(healthCheckResult);

      return;
    }
    reply.code(200).send();
    return;
  },
});

fastify.post('/:source/product/detail', {
  // eslint-disable-next-line max-statements
  async handler(req, reply) {
    const requestId = req.id;
    const { product, taskId } = req.body as {
      product: {
        productId: string;
        productUrl: string;
      };
      taskId: string;
    };
    const { source } = req.params as { source: PRODUCT_SOURCE };
    const { productId, productUrl } = product;
    const logger = req.log.child({ taskId });
    logger.info(
      `Receive process product detail of ${product.productId} on ${source}`,
      {
        product: productId,
      },
    );
    const database = createDatabaseConnection();

    const taskState = connectTaskStateOnDatabase(database, requestId, taskId);
    if (!(await taskState.shouldTaskRun())) {
      logger.error("Task already done or shouldn't retry");
      return reply.code(208).send('208 Already Reported');
    }
    const lock = createLockHandlerOnDatabase(database, requestId, taskId);
    if (await lock.checkRequestLockExist()) {
      return reply.send(409).send('409 Conflict');
    }
    await lock.acquireLock({
      product,
      taskName: `${source}-product-detail`,
    });
    logger.info(
      `Start process product detail of ${product.productId} on ${source}`,
      {
        product: productId,
      },
    );
    const replyStream = connectReplyStreamOnDatabase(
      database,
      requestId,
      source,
      productId,
    );
    const cache = connectProductCacheOnDatabase(database, source, productId);
    const cachedProduct = await cache.getCachedSearchData();

    if (cachedProduct.ok) {
      logger.info(
        `Complete process product detail of ${product.productId} on ${source}`,
        {
          product: cachedProduct.data,
        },
      );
      const batchWrite = database.batch();
      batchWrite.set(
        replyStream.repliesStream,
        replyStream.shapeOfReplyStreamItem({
          data: cachedProduct.data,
          type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL,
        }),
      );
      batchWrite.set(
        taskState.taskState,
        taskState.shapeOfTaskStateObject(TASK_STATE.DONE),
      );
      batchWrite.delete(lock.lock);
      await batchWrite.commit();
      return reply.code(204).send();
    }
    const tokenBucket = connectTokenBucketOnDatabase(database);
    try {
      if (!(await tokenBucket.consume(source)).ok) {
        throw error.withHTTPError(429, '429 Too Many Requests', {
          retryAble: true,
        })(
          error.withErrorCode('ERR_RATE_LIMIT_EXCEEDED')(
            new Error('Failed to fetch product details'),
          ),
        );
      }
      const product = await requestQueue.processRequest({
        options: {
          logger,
        },
        productId: productId,
        productUrl: productUrl,
        requestId: requestId,
        source: source,
      });
      const batchWrite = database.batch();
      batchWrite.set(
        replyStream.repliesStream,
        replyStream.shapeOfReplyStreamItem({
          data: product,
          type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL,
        }),
      );
      batchWrite.set(cache.cachedProduct, cache.shapeOfCachedProduct(product));
      batchWrite.set(
        taskState.taskState,
        taskState.shapeOfTaskStateObject(TASK_STATE.DONE),
      );
      batchWrite.delete(lock.lock);
      await batchWrite.commit();
      logger.info(
        `Complete process product detail of ${product.id} on ${source}`,
        {
          product: product,
        },
      );
      return reply.code(204).send();
    } catch (e) {
      logger.error(
        `Failed process product detail of ${product.productId} on ${source}`,
        {
          error: Object.assign(
            {
              code: error.isNativeError(e) ? e['code'] : 'ERR_UNEXPECTED_ERROR',
              message: error.isNativeError(e) ? e['message'] : 'Unknown error',
            },
            error.isNativeError(e) && e['code'] ? {} : { raw: e },
          ),
          payload: req.body,
        },
      );
      const batchWrite = database.batch();
      if (error.isHTTPError(e)) {
        if (!e.http.retryAble) {
          batchWrite.set(
            taskState.taskState,
            taskState.shapeOfTaskStateObject(TASK_STATE.ERROR),
          );
          batchWrite.set(
            replyStream.repliesStream,
            replyStream.shapeOfReplyStreamItem({
              error: {
                code: e.code ?? 'ERR_UNEXPECTED_ERROR',
                message: e.message,
                meta: {
                  payload: req.body,
                  productId: productId,
                },
              },
              type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_FAILURE,
            }),
          );
        }
      } else {
        batchWrite.set(
          taskState.taskState,
          taskState.shapeOfTaskStateObject(TASK_STATE.ERROR),
        );
        batchWrite.set(
          replyStream.repliesStream,
          replyStream.shapeOfReplyStreamItem({
            error: {
              code: error.isNativeError(e)
                ? e.code ?? 'ERR_UNEXPECTED_ERROR'
                : 'ERR_UNEXPECTED_ERROR',
              message: error.isNativeError(e) ? e.message : 'Unknown error',
              meta: {
                payload: req.body,
                productId: productId,
              },
            },
            type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_FAILURE,
          }),
        );
      }
      batchWrite.delete(lock.lock);
      await batchWrite.commit();
      if (error.isHTTPError(e)) {
        return reply.code(e.http.statusCode).send(e.http.message);
      }
      return reply.code(500).send('Internal Server Error');
    }
  },
  schema: {
    body: {
      properties: {
        product: {
          properties: {
            productId: { type: 'string' },
            productUrl: { type: 'string' },
          },
          required: ['productId', 'productUrl'],
          type: 'object',
        },
        taskId: { type: 'string' },
      },
      required: ['product', 'taskId'],
      type: 'object',
    },
    headers: {
      properties: {
        'request-id': { type: 'string' },
      },
      required: ['request-id'],
      type: 'object',
    },
    params: {
      properties: {
        source: { enum: Object.values(PRODUCT_SOURCE), type: 'string' },
      },
      required: ['source'],
      type: 'object',
    },
  },
});

fastify.post('/', {
  async handler(req, reply) {
    const requestId = req.id;
    const host = req.headers.host;
    if (!host) {
      req.log.error('Host header is missing');
      reply.code(400).send('400 Bad Request');
      return;
    }
    const database = createDatabaseConnection();
    const { product, taskId } = req.body as {
      product: {
        productId: string;
        productUrl: string;
        source: PRODUCT_SOURCE;
      };
      taskId: string;
    };
    const logger = req.log.child({ taskId });

    const { productId, productUrl, source } = product;
    const taskState = connectTaskStateOnDatabase(database, requestId, taskId);

    if (!(await taskState.shouldTaskRun())) {
      logger.error("Task already done or shouldn't retry");
      return reply.code(208).send('208 Already Reported');
    }
    const lock = createLockHandlerOnDatabase(database, requestId, taskId);
    if (await lock.checkRequestLockExist()) {
      return reply.send(409).send('409 Conflict');
    }
    await lock.acquireLock({
      taskName: 'product-detail',
    });
    const productDetailSubTaskScheduler = createProductDetailSubTaskScheduler(
      createCloudTaskClient(),
      requestId,
      host,
    );

    logger.info(
      `Start re-routing product detail task of ${product.productId} on ${product.source}`,
      {
        product: productId,
      },
    );
    try {
      const { id: taskId } =
        await productDetailSubTaskScheduler.scheduleProductSearchSubTask(
          source,
          {
            productId,
            productUrl,
          },
        );
      logger.info(
        `Complete re-routing product detail task of ${product.productId} on ${product.source}`,
        { taskId },
      );
      const batchWrite = database.batch();
      batchWrite.set(
        taskState.taskState,
        taskState.shapeOfTaskStateObject(TASK_STATE.DONE),
      );
      batchWrite.delete(lock.lock);
      await batchWrite.commit();
      return reply.code(204).send();
    } catch (e) {
      logger.error(
        `Failed re-routing product detail task of ${product.productId} on ${product.source}`,
        {
          error: Object.assign(
            {
              code: error.isNativeError(e) ? e['code'] : 'ERR_UNEXPECTED_ERROR',
              message: error.isNativeError(e) ? e['message'] : 'Unknown error',
            },
            error.isNativeError(e) && e['code'] ? {} : { raw: e },
          ),
          payload: req.body,
        },
      );
      const batchWrite = database.batch();
      if (error.isHTTPError(e)) {
        if (!e.http.retryAble) {
          batchWrite.set(
            taskState.taskState,
            taskState.shapeOfTaskStateObject(TASK_STATE.ERROR),
          );
        }
      } else {
        batchWrite.set(
          taskState.taskState,
          taskState.shapeOfTaskStateObject(TASK_STATE.ERROR),
        );
      }
      batchWrite.delete(lock.lock);
      await batchWrite.commit();
      if (error.isHTTPError(e)) {
        return reply.code(e.http.statusCode).send(e.http.message);
      }
      return reply.code(500).send('Internal Server Error');
    }
  },
  schema: {
    body: {
      properties: {
        product: {
          properties: {
            productId: { type: 'string' },
            productUrl: { type: 'string' },
            source: { enum: Object.values(PRODUCT_SOURCE), type: 'string' },
          },
          required: ['productId', 'productUrl', 'source'],
          type: 'object',
        },
        taskId: { type: 'string' },
      },
      required: ['product', 'taskId'],
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
  for (const source of Object.values(PRODUCT_SOURCE)) {
    await tokenBucket.refill(source);
  }
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
