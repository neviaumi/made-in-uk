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
  createDatabaseConnection,
  createReplyStreamOnDatabase,
} from '@/database.ts';
import { createLogger } from '@/logger.ts';
import { REPLY_DATA_TYPE } from '@/types.ts';

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
    requestId,
  });
  const database = createDatabaseConnection();
  const writeToReplyStream = createReplyStreamOnDatabase(database);
  const pubSubPushMessage = verifiedPubSubPushMessage.data;
  const jsonMessageBody = JSON.parse(pubSubPushMessage.message.data);
  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();

  const productInfo = await createProductDetailsHandler(page, {
    logger: loggerWithRequestId,
  })(jsonMessageBody.productUrl)
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
    await writeToReplyStream(requestId, {
      error: productInfo.error,
      type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_FAILURE,
    });
    res.statusCode = 204;
    res.end();
    return;
  }
  await writeToReplyStream(requestId, {
    data: productInfo.data,
    type: REPLY_DATA_TYPE.PRODUCT_DETAIL,
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
