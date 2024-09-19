import { CloudTasksClient } from '@google-cloud/tasks';
import { credentials } from '@grpc/grpc-js';

import { getInstanceServiceAccount } from '@/cloud-run.ts';
import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import type { PRODUCT_SOURCE } from '@/types.ts';

const config = loadConfig(APP_ENV);

export enum TASK_STATE {
  DONE = 'DONE',
  ERROR = 'ERROR',
}

export function createCloudTaskClient(
  ...args: ConstructorParameters<typeof CloudTasksClient>
) {
  const shouldUseEmulator = config.get('cloudTasks.useEmulator');
  if (shouldUseEmulator) {
    const emulatorHost = new URL(
      `gcp://${config.get('cloudTasks.emulatorHost')}`,
    );
    return new CloudTasksClient({
      ...args,
      port: Number(emulatorHost.port),
      servicePath: emulatorHost.hostname,
      sslCreds: credentials.createInsecure(),
    });
  }
  return new CloudTasksClient(...args);
}

export function createProductSearchSubTaskScheduler(
  cloudTask: CloudTasksClient,
  host: string,
) {
  return {
    async scheduleProductSearchSubTask(payload: {
      parentRequestId: string;
      requestId: string;
      search: {
        keyword: string;
        source: PRODUCT_SOURCE;
      };
    }) {
      return cloudTask.createTask({
        parent: String(config.get('cloudTasks.productSearchSubTaskQueue')),
        task: {
          httpRequest: {
            body: Buffer.from(
              JSON.stringify({
                parentRequestId: payload.parentRequestId,
                search: payload.search,
                taskId: crypto.randomUUID(),
              }),
            ).toString('base64'),
            headers: {
              'Content-Type': 'application/json',
              'Request-Id': payload.requestId,
            },
            httpMethod: 'POST',
            oidcToken: ![AppEnvironment.DEV, AppEnvironment.TEST].includes(
              APP_ENV,
            )
              ? {
                  serviceAccountEmail: await getInstanceServiceAccount(),
                }
              : null,
            url: new URL(
              '/search',
              `${[AppEnvironment.DEV, AppEnvironment.TEST].includes(APP_ENV) ? 'http' : 'https'}://${host}`,
            ).toString(),
          },
        },
      });
    },
  };
}

export function createProductDetailScheduler(cloudTask: CloudTasksClient) {
  return {
    async scheduleProductDetailTask(payload: {
      product: {
        productId: string;
        productUrl: string;
        source: string;
      };
      requestId: string;
    }) {
      return cloudTask.createTask({
        parent: String(config.get('cloudTasks.productDetailQueue')),
        task: {
          httpRequest: {
            body: Buffer.from(
              JSON.stringify({
                product: payload.product,
                taskId: crypto.randomUUID(),
              }),
            ).toString('base64'),
            headers: {
              'Content-Type': 'application/json',
              'Request-Id': payload.requestId,
            },
            httpMethod: 'POST',
            oidcToken: ![AppEnvironment.DEV, AppEnvironment.TEST].includes(
              APP_ENV,
            )
              ? {
                  serviceAccountEmail: await getInstanceServiceAccount(),
                }
              : null,
            url: String(config.get('productDetail.endpoint')),
          },
        },
      });
    },
  };
}
