import { CloudTasksClient } from '@google-cloud/tasks';
import { credentials } from '@grpc/grpc-js';

import { getInstanceServiceAccount } from '@/cloud-run.ts';
import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';

const config = loadConfig(APP_ENV);

export enum TASK_TYPE {
  FETCH_PRODUCT_DETAIL = 'FETCH_PRODUCT_DETAIL',
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

export function createTaskId(taskId: string) {
  return `${String(config.get('cloudTasks.productDetailQueue'))}/tasks/${taskId}`;
}

export function createProductDetailScheduler(cloudTask: CloudTasksClient) {
  return {
    async scheduleProductDetailTask(
      payload: {
        product: {
          productId: string;
          productUrl: string;
          source: string;
        };
        requestId: string;
        type: TASK_TYPE;
      },
      options: {
        name: NonNullable<
          Parameters<CloudTasksClient['createTask']>[0]['task']
        >['name'];
      },
    ) {
      return cloudTask.createTask({
        parent: String(config.get('cloudTasks.productDetailQueue')),
        task: {
          httpRequest: {
            body: Buffer.from(
              JSON.stringify({ product: payload.product, type: payload.type }),
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
          name: options.name,
        },
      });
    },
  };
}
