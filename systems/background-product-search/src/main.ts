import { createServer, type RequestListener } from 'node:http';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductsSearchHandler,
} from '@/browser.ts';
import { APP_ENV, loadConfig } from '@/config.ts';
import {
  connectReplyStreamOnDatabase,
  createDatabaseConnection,
} from '@/database.ts';
import { createLogger } from '@/logger.ts';
import { createPubSubClient, getProductDetailTopic } from '@/pubsub.ts';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);

const server = createServer(async (req, res) => {
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
  const pubSubPushMessage = verifiedPubSubPushMessage.data;
  const jsonMessageBody = JSON.parse(pubSubPushMessage.message.data);
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
    await connectReplyStreamOnDatabase(database, {
      logger: loggerWithRequestId,
    })(requestId, {
      error: {
        code: matchProducts.error.code,
        message: matchProducts.error.message,
      },
      search: jsonMessageBody.search,
      total: 0,
    });
    res.statusCode = 500;
    res.end(matchProducts.error.message);
    return;
  }
  await connectReplyStreamOnDatabase(database, {
    logger: loggerWithRequestId,
  })(requestId, {
    search: jsonMessageBody.search,
    total: matchProducts.data.length,
  });
  const pubsub = createPubSubClient();
  const productDetailTopic = getProductDetailTopic(pubsub)({
    batching: {
      maxMessages: 512,
      maxMilliseconds: Math.max(matchProducts.data.length * 1000, 1000),
    },
  });
  await Promise.all(
    matchProducts.data.map(productUrl => {
      productDetailTopic.publishMessage({
        attributes: {
          requestId: requestId,
        },
        data: Buffer.from(
          JSON.stringify({
            productUrl: productUrl,
            source: 'ocado',
          }),
        ),
      });
    }),
  );

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
