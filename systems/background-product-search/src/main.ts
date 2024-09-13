import { createServer, type RequestListener } from 'node:http';
import { Readable } from 'node:stream';

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
import { APP_ENV, loadConfig } from '@/config.ts';
import {
  connectLockHandlerOnDatabase,
  connectProductSearchCacheOnDatabase,
  connectReplyStreamOnDatabase,
  createDatabaseConnection,
  databaseHealthCheck,
  Timestamp,
} from '@/database.ts';
import { createLogger } from '@/logger.ts';
import { REPLY_DATA_TYPE } from '@/types.ts';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);

async function handleHealthCheck(res: Parameters<RequestListener>[1]) {
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
    res.statusCode = 503;
    res.end(JSON.stringify(healthCheckResult));
    return;
  }
  res.statusCode = 200;
  res.end();
}

// TODO: Refactor this function to reduce complexity
// Obvious the refactor can do when doing rate limit feature
// eslint-disable-next-line max-statements
const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    await handleHealthCheck(res);
    return;
  }
  const verifiedIncomingMessage = await validateIncomingMessage(req);
  if (!verifiedIncomingMessage.ok) {
    res.statusCode = Number(verifiedIncomingMessage.error.code);
    res.end(verifiedIncomingMessage.error.message);
    return;
  }
  const requestId = verifiedIncomingMessage.requestId;
  const loggerWithRequestId = logger.child({
    requestId: requestId,
  });
  const database = createDatabaseConnection();
  const lock = connectLockHandlerOnDatabase(database, requestId);
  if (await lock.checkRequestLockExist()) {
    loggerWithRequestId.info('Request already processed');
    res.statusCode = 409;
    res.end('409 Conflict');
    return;
  }
  const cloudTask = createCloudTaskClient();

  const replyStream = connectReplyStreamOnDatabase(database, requestId);
  const payload = verifiedIncomingMessage.data;
  await lock.acquireLock();

  const search = payload['search'] as { keyword: string };
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
          logger: loggerWithRequestId,
        })(search.keyword);
        const stream = Readable.from(generator);
        stream.on('end', async () => {
          await closePage(page);
          await closeBrowser(browser);
        });
        return stream;
      })();

  if (dbCachedResult.ok) {
    loggerWithRequestId.info('Product search cache hit', {
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
    loggerWithRequestId.info('Product search completed', {
      numberOfProducts,
    });
    res.statusCode = 204;
    res.end();
  } catch (e) {
    if (e instanceof Error) {
      loggerWithRequestId.error(e.message, {
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
      res.statusCode = 500;
      res.end(e.message);
    }
  }
});

server.listen(config.get('port'), () => {
  logger.info(`Server is running on http://localhost:${config.get('port')}/`);
  if (import.meta.hot) {
    function killServer() {
      server.close(err => {
        if (err) {
          throw err;
        }
      });
    }
    import.meta.hot.on('vite:beforeFullReload', () => {
      logger.debug('vite:beforeFullReload');
      killServer();
    });
    import.meta.hot.dispose(() => {
      logger.debug('dispose');
      killServer();
    });
  }
});

async function validateIncomingMessage(
  req: Parameters<RequestListener>[0],
): Promise<
  | {
      error: {
        code: string;
        message: string;
      };
      ok: false;
    }
  | {
      data: Record<string, unknown>;
      ok: true;
      requestId: string;
    }
> {
  const requestId = String(req.headers['request-id']);
  if (!requestId) {
    logger.debug('Request without request-id header');
    return {
      error: {
        code: '400',
        message: 'Bad request',
      },
      ok: false,
    };
  }

  const body = (await req.toArray()).join('');
  if (!body) {
    logger.debug('Empty body');
    return {
      error: {
        code: '400',
        message: 'Bad request',
      },
      ok: false,
    };
  }
  if (
    (content => {
      try {
        JSON.parse(content);
        return false;
      } catch (e) {
        return true;
      }
    })(body)
  ) {
    logger.debug('Non JSON body', {
      body,
    });
    return {
      error: {
        code: '400',
        message: 'Bad request',
      },
      ok: false,
    };
  }
  const jsonBody = JSON.parse(body);
  logger.debug('JSON body', {
    body: jsonBody,
  });
  return {
    data: jsonBody,
    ok: true,
    requestId,
  };
}
