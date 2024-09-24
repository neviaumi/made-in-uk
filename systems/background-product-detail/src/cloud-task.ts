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

export function createProductDetailSubTaskScheduler(
  cloudTask: CloudTasksClient,
  requestId: string,
  host: string,
) {
  return {
    async scheduleProductSearchSubTask(
      source: PRODUCT_SOURCE,
      payload: {
        productId: string;
        productUrl: string;
      },
    ) {
      const queueName = config.get(`cloudTasks.${source}.queueName`);
      if (!queueName) {
        throw new Error(`Queue name for ${source} is not configured`);
      }
      const taskId = crypto.randomUUID();
      await cloudTask.createTask({
        parent: String(queueName),
        task: {
          httpRequest: {
            body: Buffer.from(
              JSON.stringify({
                product: {
                  productId: payload.productId,
                  productUrl: payload.productUrl,
                },
                taskId: taskId,
              }),
            ).toString('base64'),
            headers: {
              'Content-Type': 'application/json',
              'Request-Id': requestId,
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
              `/${source}/product/detail`,
              `${[AppEnvironment.DEV, AppEnvironment.TEST].includes(APP_ENV) ? 'http' : 'https'}://${host}`,
            ).toString(),
          },
        },
      });
      return { id: taskId };
    },
  };
}
