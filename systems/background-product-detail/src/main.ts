import { createServer, type RequestListener } from 'node:http';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductDetailsHandler,
} from '@/browser.ts';
import { APP_ENV, loadConfig } from '@/config.ts';
import {
  checkRequestStreamOnDatabase,
  createDatabaseConnection,
  createReplyStreamOnDatabase,
  databaseHealthCheck,
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

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    await handleHealthCheck(res);
    return;
  }
  const verifiedPubSubPushMessage = await validatePubSubPushMessage(req);
  if (!verifiedPubSubPushMessage.ok) {
    res.statusCode = Number(verifiedPubSubPushMessage.error.code);
    res.end(verifiedPubSubPushMessage.error.message);
    return;
  }
  const requestId =
    verifiedPubSubPushMessage.data.message.attributes['requestId'];
  const loggerWithRequestId = logger.child({
    requestId,
  });
  const database = createDatabaseConnection();
  const writeToReplyStream = createReplyStreamOnDatabase(database);
  const pubSubPushMessage = verifiedPubSubPushMessage.data;
  const jsonMessageBody = JSON.parse(pubSubPushMessage.message.data);
  const { productId, productUrl } = jsonMessageBody;
  if (!productId || !productUrl) {
    loggerWithRequestId.error('Invalid message body', {
      message: jsonMessageBody,
    });
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  if (await checkRequestStreamOnDatabase(database)(requestId, productId)) {
    loggerWithRequestId.info('Request already exist', {
      productId,
      productUrl,
      requestId,
    });
    res.statusCode = 204;
    res.end();
    return;
  }
  await writeToReplyStream(requestId, productId, {
    type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_LOCK,
  });
  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();

  const productInfo = await createProductDetailsHandler(page, {
    logger: loggerWithRequestId,
  })(productUrl)
    .catch(e => ({
      error: {
        code: 'ERR_UNHANDLED_EXCEPTION',
        message: e.message,
        meta: { message: jsonMessageBody },
      },
      ok: false as const,
    }))
    .finally(async () => {
      await closePage(page);
      await closeBrowser(browser);
    });
  if (!productInfo.ok) {
    await writeToReplyStream(requestId, productId, {
      error: productInfo.error,
      type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_FAILURE,
    });
    res.statusCode = 204;
    res.end();
    return;
  }
  await writeToReplyStream(requestId, productId, {
    data: productInfo.data,
    type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL,
  });
  res.statusCode = 204;
  res.end();
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

async function validatePubSubPushMessage(
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
      data: {
        message: {
          attributes: Record<string, string>;
          data: string;
        };
      };
      ok: true;
    }
> {
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
  if (!jsonBody.message) {
    return {
      error: {
        code: '400',
        message: 'Bad request',
      },
      ok: false,
    };
  }
  return {
    data: {
      ...jsonBody,
      message: {
        ...jsonBody.message,
        data: Buffer.from(jsonBody.message.data, 'base64').toString('utf-8'),
      },
    },
    ok: true,
  };
}
