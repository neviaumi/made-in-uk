import { createServer, type RequestListener } from 'node:http';

import { Timestamp } from '@google-cloud/firestore';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductDetailsHandler,
} from '@/browser.ts';
import { APP_ENV, loadConfig } from '@/config.ts';
import {
  connectToProductDatabase,
  createDatabaseConnection,
  createLockHandlerOnDatabase,
  createReplyStreamOnDatabase,
  databaseHealthCheck,
} from '@/database.ts';
import { createLogger } from '@/logger.ts';
import { REPLY_DATA_TYPE } from '@/types.ts';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);
enum TASK_TYPE {
  FETCH_PRODUCT_DETAIL = 'FETCH_PRODUCT_DETAIL',
  UPDATE_PRODUCT_DETAIL = 'UPDATE_PRODUCT_DETAIL',
}
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

async function handleFetchProductDetail(
  database: ReturnType<typeof createDatabaseConnection>,
  requestId: string,
  payload: {
    product: {
      productId: string;
      productUrl: string;
    };
  },
) {
  const {
    product: { productId, productUrl, source },
  } = payload as {
    product: {
      productId: string;
      productUrl: string;
      source: string;
    };
  };
  const replyStream = createReplyStreamOnDatabase(database);

  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();

  const productInfo = await createProductDetailsHandler(page)(productUrl)
    .catch(e => ({
      error: {
        code: 'ERR_UNHANDLED_EXCEPTION',
        message: e.message,
        meta: { payload },
      },
      ok: false as const,
    }))
    .finally(async () => {
      await closePage(page);
      await closeBrowser(browser);
    });
  if (!productInfo.ok) {
    await replyStream(requestId, productId).set({
      error: productInfo.error,
      type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_FAILURE,
    });
    return;
  }
  const batchWrite = database.batch();
  batchWrite.set(replyStream(requestId, productId), {
    data: productInfo.data,
    type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL,
  });
  batchWrite.set(
    connectToProductDatabase(database)(source, productId),
    Object.assign(productInfo.data, {
      // 1 hour
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60)),
    }),
  );
  await batchWrite.commit();
}

async function handleUpdateProductDetail(
  database: ReturnType<typeof createDatabaseConnection>,
  payload: {
    product: {
      productId: string;
      productUrl: string;
    };
  },
) {
  const {
    product: { productId, productUrl },
  } = payload as {
    product: {
      productId: string;
      productUrl: string;
    };
  };
  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();

  const productInfo = await createProductDetailsHandler(page)(productUrl)
    .catch(e => ({
      error: {
        code: 'ERR_UNHANDLED_EXCEPTION',
        message: e.message,
        meta: { payload },
      },
      ok: false as const,
    }))
    .finally(async () => {
      await closePage(page);
      await closeBrowser(browser);
    });
  if (!productInfo.ok) {
    await connectToProductDatabase(database)('ocado', productId).delete();
    return;
  }
  await connectToProductDatabase(database)('ocado', productId).set(
    Object.assign(productInfo.data, {
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60)),
    }),
  );
}

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
  const lock = createLockHandlerOnDatabase(database);
  const payload = verifiedIncomingMessage.data;
  const { product, type } = payload as {
    product: {
      productId: string;
      productUrl: string;
      source: string;
    };
    type: TASK_TYPE;
  };
  if (!product.productId || !product.productUrl) {
    loggerWithRequestId.error('Invalid message body', {
      message: payload,
    });
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  if (await lock.checkRequestLock(requestId, product.productId)) {
    loggerWithRequestId.info('Request already exist', {
      product,
      requestId,
    });
    res.statusCode = 204;
    res.end();
    return;
  }
  await lock.acquireLock(requestId, product.productId, payload);
  if (type === TASK_TYPE.FETCH_PRODUCT_DETAIL) {
    await handleFetchProductDetail(database, requestId, { product });
  } else if (type === TASK_TYPE.UPDATE_PRODUCT_DETAIL) {
    await handleUpdateProductDetail(database, { product });
  } else {
    loggerWithRequestId.error('Invalid message type', {
      message: payload,
    });
  }
  await lock.releaseLock(requestId, product.productId);
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
