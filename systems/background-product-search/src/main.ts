import { Readable } from 'node:stream';

import Fastify from 'fastify';
import hashObject from 'hash-object';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductsSearchHandler,
} from '@/browser.ts';
import {
  createCloudTaskClient,
  createProductDetailScheduler,
} from '@/cloud-task.ts';
import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import {
  connectLockHandlerOnDatabase,
  connectProductSearchCacheOnDatabase,
  connectReplyStreamOnDatabase,
  createDatabaseConnection,
  databaseHealthCheck,
  Timestamp,
} from '@/database.ts';
import { adaptToFastifyLogger, createLogger } from '@/logger.ts';
import { REPLY_DATA_TYPE } from '@/types.ts';

const config = loadConfig(APP_ENV);

const fastify = Fastify({
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

fastify.post('/', {
  async handler(req, reply) {
    const requestId = req.id;
    const logger = req.log;
    const database = createDatabaseConnection();
    const lock = connectLockHandlerOnDatabase(database, requestId);
    if (await lock.checkRequestLockExist()) {
      logger.info('Request already processed');
      reply.code(409).send('409 Conflict');
      return;
    }
    const cloudTask = createCloudTaskClient();
    const replyStream = connectReplyStreamOnDatabase(database, requestId);
    const payload = req.body as { search: { keyword: string } };
    await lock.acquireLock();

    const search = payload.search;
    const dbCache = connectProductSearchCacheOnDatabase(
      database,
      'OCADO',
      hashObject(search),
    );
    const dbCachedResult = await dbCache.getCachedSearchData();

    const matchProductStream = dbCachedResult.ok
      ? Readable.from(Object.entries(dbCachedResult.data))
      : await (async () => {
          const browser = await createChromiumBrowser();
          const page = await createBrowserPage(browser)();
          const generator = createProductsSearchHandler(page, {
            logger,
          })(search.keyword);
          const stream = Readable.from(generator);
          stream.on('end', async () => {
            await closePage(page);
            await closeBrowser(browser);
          });
          return stream;
        })();

    if (dbCachedResult.ok) {
      logger.info('Product search cache hit', {
        hitsLength: Object.entries(dbCachedResult.data).length,
        source: 'OCADO',
      });
    }

    const matchedProducts = [];
    const productDetailScheduler = createProductDetailScheduler(cloudTask);
    try {
      for await (const [productId, productUrl] of matchProductStream) {
        matchedProducts.push([productId, productUrl]);
        await productDetailScheduler.scheduleProductDetailTask({
          product: {
            productId,
            productUrl,
            source: 'OCADO',
          },
          requestId: requestId,
        });
      }
      const numberOfProducts = matchedProducts.length;
      const dbBatch = database.batch();
      if (!dbCachedResult.ok)
        dbBatch.set(dbCache.cachedSearch, {
          expiresAt: Timestamp.fromDate(
            // 3 days
            new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
          ),
          hits: Object.fromEntries(matchedProducts),
        });
      dbBatch.set(replyStream.repliesStreamHeader, {
        data: { total: numberOfProducts },
        search: search,
        type: REPLY_DATA_TYPE.PRODUCT_SEARCH,
      });
      dbBatch.delete(lock.lock);
      await dbBatch.commit();
      logger.info('Product search completed', {
        numberOfProducts,
      });
      reply.code(204).send('204 No Content');
    } catch (e) {
      if (e instanceof Error) {
        logger.error(e.message, {
          e,
        });
        const dbBatch = database.batch();
        dbBatch.set(replyStream.repliesStreamHeader, {
          error: {
            // @ts-expect-error code is not defined on Error
            code: e['code'] ?? 'ERR_UNEXPECTED_ERROR',
            message: e.message,
          },
          search: search,
          type: REPLY_DATA_TYPE.PRODUCT_SEARCH_ERROR,
        });
        dbBatch.delete(lock.lock);
        await dbBatch.commit();
        reply.code(500).send(e.message);
      }
    }
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
      },
      required: ['search'],
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

fastify.listen(
  {
    port: config.get('port'),
  },
  (err, address) => {
    if (err) {
      fastify.log.error(err);
      throw err;
    }
    if (APP_ENV === AppEnvironment.DEV) {
      fastify.addresses();
      setInterval(() => {
        fastify.log.info('Server cron job is running', {
          address,
        });
      }, 60000);
    }
  },
);
