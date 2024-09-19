import Fastify from 'fastify';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
} from '@/browser.ts';
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
import * as lilysKitchen from '@/lilys-kitchen.ts';
import { adaptToFastifyLogger, createLogger } from '@/logger.ts';
import * as ocado from '@/ocado.ts';
import * as petsAtHome from '@/pets-at-home.ts';
import { PRODUCT_SOURCE, REPLY_DATA_TYPE, TASK_STATE } from '@/types.ts';
import * as vetShop from '@/vet-shop.ts';
import * as zooplus from '@/zooplus.ts';

const config = loadConfig(APP_ENV);

const fastify = Fastify({
  // We are using Winston for logging and fastify wasn't able to customize the request object on log
  disableRequestLogging: true,
  genReqId() {
    return crypto.randomUUID();
  },
  loggerInstance: adaptToFastifyLogger(createLogger(APP_ENV)),
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

fastify.post('/', {
  // eslint-disable-next-line max-statements
  async handler(req, reply) {
    const requestId = req.id;
    const logger = req.log;
    const database = createDatabaseConnection();
    const { product, taskId } = req.body as {
      product: {
        productId: string;
        productUrl: string;
        source: PRODUCT_SOURCE;
      };
      taskId: string;
    };

    const { productId, productUrl, source } = product;
    const taskState = connectTaskStateOnDatabase(database, requestId, taskId);
    if (!(await taskState.shouldTaskRun())) {
      logger.error("Task already done or shouldn't retry");
      reply.code(208).send('208 Already Reported');
      return;
    }
    const lock = createLockHandlerOnDatabase(database, requestId, productId);
    if (await lock.checkRequestLockExist()) {
      reply.send(409).send('409 Conflict');
      return;
    }
    await lock.acquireLock();
    logger.info(
      `Start process product detail of ${product.productId} on ${product.source}`,
      {
        product: productId,
      },
    );
    const replyStream = connectReplyStreamOnDatabase(
      database,
      requestId,
      productId,
    );
    const cache = connectProductCacheOnDatabase(database, source, productId);
    const cachedProduct = await cache.getCachedSearchData();

    if (cachedProduct.ok) {
      logger.info(
        `Complete process product detail of ${product.productId} on ${product.source}`,
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
      reply.code(204).send();
      return;
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
      const browser = await createChromiumBrowser();
      const page = await createBrowserPage(browser)();
      const fetchers = {
        [PRODUCT_SOURCE.LILYS_KITCHEN]: lilysKitchen,
        [PRODUCT_SOURCE.OCADO]: ocado,
        [PRODUCT_SOURCE.PETS_AT_HOME]: petsAtHome,
        [PRODUCT_SOURCE.ZOOPLUS]: zooplus,
        [PRODUCT_SOURCE.VET_SHOP]: vetShop,
        [PRODUCT_SOURCE.SAINSBURY]: {
          createProductDetailsFetcher: () => {
            throw new Error('Not implemented');
          },
        }, // This is a dummy value
      };
      const productInfo = await fetchers[source]
        .createProductDetailsFetcher(page, {
          logger: logger,
          requestId: requestId,
        })(productUrl)
        .finally(async () => {
          await closePage(page);
          await closeBrowser(browser);
        });
      if (!productInfo.ok) {
        throw error.withHTTPError(500, 'Failed to fetch product details', {
          retryAble: true,
        })(
          error.withErrorCode('ERR_UNEXPECTED_ERROR')(
            new Error('Failed to fetch product details'),
          ),
        );
      }
      const batchWrite = database.batch();
      batchWrite.set(
        replyStream.repliesStream,
        replyStream.shapeOfReplyStreamItem({
          data: productInfo.data,
          type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL,
        }),
      );
      batchWrite.set(
        cache.cachedProduct,
        cache.shapeOfCachedProduct(productInfo.data),
      );
      batchWrite.set(
        taskState.taskState,
        taskState.shapeOfTaskStateObject(TASK_STATE.DONE),
      );
      batchWrite.delete(lock.lock);
      await batchWrite.commit();
      logger.info(
        `Complete process product detail of ${product.productId} on ${product.source}`,
        {
          product: productInfo.data,
        },
      );
      reply.code(204).send();
    } catch (e) {
      logger.error(
        `Failed process product detail of ${product.productId} on ${product.source}`,
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
              },
            },
            type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_FAILURE,
          }),
        );
      }
      batchWrite.delete(lock.lock);
      await batchWrite.commit();
      if (error.isHTTPError(e)) {
        reply.code(e.http.statusCode).send(e.http.message);
        return;
      }
      reply.code(500).send('Internal Server Error');
      return;
    }

    return;
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

fastify.post('/token-bucket/refill', async (req, reply) => {
  const logger = req.log;
  const tokenBucket = connectTokenBucketOnDatabase(createDatabaseConnection());
  for (const source of Object.values(PRODUCT_SOURCE)) {
    await tokenBucket.refill(source);
  }
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
