import { createServer, type RequestListener } from 'node:http';

import pMap from 'p-map';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductsSearchHandler,
} from '@/browser.ts';
import {
  computeScheduleSeconds,
  createCloudTaskClient,
  createProductDetailScheduler,
  createTaskId,
  ONE_HOUR,
  TASK_TYPE,
  withTaskAlreadyExistsErrorHandler,
} from '@/cloud-task.ts';
import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import {
  connectReplyStreamOnDatabase,
  connectToProductDatabase,
  createDatabaseConnection,
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
  const verifiedIncomingMessage = await validateIncomingMessage(req);
  if (!verifiedIncomingMessage.ok) {
    res.statusCode = Number(verifiedIncomingMessage.error.code);
    res.end(verifiedIncomingMessage.error.message);
    return;
  }
  const cloudTask = createCloudTaskClient();

  const requestId = verifiedIncomingMessage.requestId;
  const loggerWithRequestId = logger.child({
    requestId: requestId,
  });
  const database = createDatabaseConnection();
  const replyStream = connectReplyStreamOnDatabase(database, {
    logger: loggerWithRequestId,
  });
  if (await replyStream.checkRequestAlreadyExist(requestId)) {
    loggerWithRequestId.info('Request already processed');
    res.statusCode = 204;
    res.end();
    return;
  }
  const payload = verifiedIncomingMessage.data;
  await replyStream.writeToRepliesStreamHeader(requestId, {
    type: REPLY_DATA_TYPE.PRODUCT_SEARCH_LOCK,
  });
  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();
  const search = payload['search'] as { keyword: string };

  const matchProducts = await createProductsSearchHandler(page, {
    logger: loggerWithRequestId,
  })(search.keyword)
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
    await replyStream.writeToRepliesStreamHeader(requestId, {
      error: {
        code: matchProducts.error.code,
        message: matchProducts.error.message,
      },
      search: search,
      type: REPLY_DATA_TYPE.PRODUCT_SEARCH_ERROR,
    });
    res.statusCode = 500;
    res.end(matchProducts.error.message);
    return;
  }
  const productToSearchDetails = [
    AppEnvironment.TEST,
    AppEnvironment.DEV,
  ].includes(APP_ENV)
    ? Object.entries(matchProducts.data).slice(0, 10)
    : Object.entries(matchProducts.data);
  const numberOfProducts = productToSearchDetails.length;

  const scheduleProductDetailTask = createProductDetailScheduler(cloudTask);
  await pMap(
    productToSearchDetails,
    async ([productId, productUrl], index) => {
      return connectToProductDatabase(database)
        .getProductOrFail('ocado', productId)
        .then(async product => {
          loggerWithRequestId.debug('Response product from cache', {
            productId,
          });
          await replyStream.writeToRepliesStream(requestId, productId, {
            data: product,
            type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL,
          });
          withTaskAlreadyExistsErrorHandler(scheduleProductDetailTask)(
            {
              product: {
                productId,
                productUrl,
                source: 'ocado',
              },
              requestId: requestId,
              type: TASK_TYPE.UPDATE_PRODUCT_DETAIL,
            },
            {
              name: createTaskId(`ocado-${productId}`),
              scheduleTime: {
                seconds: computeScheduleSeconds(ONE_HOUR + index * 5),
              },
            },
          );
        })
        .catch(() => {
          withTaskAlreadyExistsErrorHandler(scheduleProductDetailTask)(
            {
              product: {
                productId,
                productUrl,
                source: 'ocado',
              },
              requestId: requestId,
              type: TASK_TYPE.FETCH_PRODUCT_DETAIL,
            },
            {
              name: createTaskId(`${requestId}-ocado-${productId}`),
            },
          );
        });
    },
    {
      concurrency: 8,
    },
  );
  await replyStream.writeToRepliesStreamHeader(requestId, {
    data: { total: numberOfProducts },
    search: search,
    type: REPLY_DATA_TYPE.PRODUCT_SEARCH,
  });
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
