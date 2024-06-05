import { createServer, type RequestListener } from 'node:http';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductsSearchHandler,
} from '@/browser.ts';
import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import {
  checkRequestStreamOnDatabase,
  connectReplyStreamOnDatabase,
  createDatabaseConnection,
  databaseHealthCheck,
} from '@/database.ts';
import { createLogger } from '@/logger.ts';
import {
  createPubSubClient,
  getProductDetailTopic,
  pubsubHealthCheck,
} from '@/pubsub.ts';
import { REPLY_DATA_TYPE } from '@/types.ts';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);

async function handleHealthCheck(res: Parameters<RequestListener>[1]) {
  const pubsub = createPubSubClient();
  const database = createDatabaseConnection();
  const [pubsubHealthCheckResult, databaseHealthCheckResult] =
    await Promise.all([
      pubsubHealthCheck(pubsub)(),
      databaseHealthCheck(database)(),
    ]);
  const info = [
    ['pubsub', pubsubHealthCheckResult.ok ? { ok: true } : null],
    ['database', databaseHealthCheckResult.ok ? { ok: true } : null],
  ].filter(([, result]) => result);
  const errors = [
    [
      'pubsub',
      pubsubHealthCheckResult.ok ? null : pubsubHealthCheckResult.error,
    ],
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
  const pubsub = createPubSubClient();
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
    requestId: requestId,
  });
  const database = createDatabaseConnection();
  const writeToReplyStream = connectReplyStreamOnDatabase(database, {
    logger: loggerWithRequestId,
  });
  if (await checkRequestStreamOnDatabase(database)(requestId)) {
    loggerWithRequestId.info('Request already processed');
    res.statusCode = 204;
    res.end();
    return;
  }
  const pubSubPushMessage = verifiedPubSubPushMessage.data;
  const jsonMessageBody = JSON.parse(pubSubPushMessage.message.data);
  await writeToReplyStream(requestId, {
    type: REPLY_DATA_TYPE.PRODUCT_SEARCH_LOCK,
  });
  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();

  const matchProducts = await createProductsSearchHandler(page, {
    logger: loggerWithRequestId,
  })(jsonMessageBody.search.keyword)
    .catch(e => ({
      error: {
        code: 'ERR_UNEXPECTED_ERROR',
        message: e.message,
      },
      ok: false as const,
    }))
    .finally(async () => {
      await closePage(page);
      await closeBrowser(browser);
    });
  if (!matchProducts.ok) {
    await writeToReplyStream(requestId, {
      error: {
        code: matchProducts.error.code,
        message: matchProducts.error.message,
      },
      search: jsonMessageBody.search,
      type: REPLY_DATA_TYPE.PRODUCT_SEARCH_ERROR,
    });
    res.statusCode = 500;
    res.end(matchProducts.error.message);
    return;
  }
  const productToSearchDetails =
    APP_ENV === AppEnvironment.DEV
      ? Object.entries(matchProducts.data).slice(0, 10)
      : Object.entries(matchProducts.data);
  const numberOfProducts = productToSearchDetails.length;

  const productDetailTopic = getProductDetailTopic(pubsub)({
    batching: {
      maxMessages: 512,
      maxMilliseconds: Math.max(numberOfProducts * 1000, 1000),
    },
  });

  await writeToReplyStream(requestId, {
    data: { total: numberOfProducts },
    search: jsonMessageBody.search,
    type: REPLY_DATA_TYPE.PRODUCT_SEARCH,
  });
  await Promise.all(
    productToSearchDetails.map(([productId, productUrl]) => {
      return productDetailTopic.publishMessage({
        attributes: {
          requestId: requestId,
        },
        data: Buffer.from(
          JSON.stringify({
            productId,
            productUrl: productUrl,
            source: 'ocado',
          }),
        ),
      });
    }),
  );
  loggerWithRequestId.info('Product search completed', {
    numberOfProducts,
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
