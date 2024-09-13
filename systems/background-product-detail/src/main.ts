import { createServer, type RequestListener } from 'node:http';

import { Timestamp } from '@google-cloud/firestore';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
} from '@/browser.ts';
import { APP_ENV, loadConfig } from '@/config.ts';
import {
  connectProductCacheOnDatabase,
  connectReplyStreamOnDatabase,
  createDatabaseConnection,
  createLockHandlerOnDatabase,
  databaseHealthCheck,
} from '@/database.ts';
import * as lilysKitchen from '@/lilys-kitchen.ts';
import { createLogger } from '@/logger.ts';
import * as ocado from '@/ocado.ts';
import * as petsAtHome from '@/pets-at-home.ts';
import { PRODUCT_SOURCE, REPLY_DATA_TYPE } from '@/types.ts';
import * as vetShop from '@/vet-shop.ts';
import * as zooplus from '@/zooplus.ts';

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
    requestId,
  });
  const database = createDatabaseConnection();
  const payload = verifiedIncomingMessage.data;
  const { product } = payload as {
    product: {
      productId: string;
      productUrl: string;
      source: PRODUCT_SOURCE;
    };
  };

  if (!product.productId || !product.productUrl) {
    loggerWithRequestId.error('Invalid message body', {
      message: payload,
    });
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  const { productId, productUrl, source } = product;
  const lock = createLockHandlerOnDatabase(database, requestId, productId);
  if (await lock.checkRequestLockExist()) {
    loggerWithRequestId.info('Request already exist', {
      product,
      requestId,
    });
    res.statusCode = 409;
    res.end('409 Conflict');
    return;
  }
  await lock.acquireLock();
  const replyStream = connectReplyStreamOnDatabase(
    database,
    requestId,
    productId,
  );
  const cache = connectProductCacheOnDatabase(database, source, productId);
  const cachedProduct = await cache.getCachedSearchData();

  if (cachedProduct.ok) {
    loggerWithRequestId.info('Response product from cache', {
      product: cachedProduct.data,
    });
    const batchWrite = database.batch();
    batchWrite.set(replyStream.repliesStream, {
      data: cachedProduct.data,
      type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL,
    });
    batchWrite.delete(lock.lock);
    await batchWrite.commit();
    res.statusCode = 204;
    res.end();
    return;
  }
  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();
  const fetchers = {
    [PRODUCT_SOURCE.LILYS_KITCHEN]: lilysKitchen,
    [PRODUCT_SOURCE.OCADO]: ocado,
    [PRODUCT_SOURCE.PETS_AT_HOME]: petsAtHome,
    [PRODUCT_SOURCE.ZOOPLUS]: zooplus,
    [PRODUCT_SOURCE.VET_SHOP]: vetShop,
  };
  const productInfo = await fetchers[source]
    .createProductDetailsFetcher(page, {
      logger: loggerWithRequestId,
      requestId: requestId,
    })(productUrl)
    .catch(e => {
      return {
        error: {
          code: 'ERR_UNHANDLED_EXCEPTION',
          message: e.message,
          meta: { payload },
        },
        ok: false as const,
      };
    })
    .finally(async () => {
      await closePage(page);
      await closeBrowser(browser);
    });
  if (!productInfo.ok) {
    await replyStream.writeProductInfoToStream({
      error: productInfo.error,
      type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_FAILURE,
    });
    return;
  }
  const batchWrite = database.batch();
  batchWrite.set(replyStream.repliesStream, {
    data: productInfo.data,
    type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL,
  });
  batchWrite.set(
    cache.cachedProduct,
    Object.assign(productInfo.data, {
      // 1 day
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24)),
    }),
  );
  batchWrite.delete(lock.lock);
  await batchWrite.commit();

  res.statusCode = 204;
  res.end();
});

server.listen(config.get('port'), () => {
  logger.info(`Server is running on http://localhost:${config.get('port')}/`);
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
    return {
      error: {
        code: '400',
        message: 'Bad request',
      },
      ok: false,
    };
  }
  const jsonBody = JSON.parse(body);
  return {
    data: jsonBody,
    ok: true,
    requestId,
  };
}
