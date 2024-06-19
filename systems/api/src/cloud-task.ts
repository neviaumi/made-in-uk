import { CloudTasksClient } from '@google-cloud/tasks';
import { credentials } from '@grpc/grpc-js';

import { getInstanceServiceAccount } from '@/cloud-run.ts';
import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';

const config = loadConfig(APP_ENV);

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

export function createProductSearchScheduler(cloudTask: CloudTasksClient) {
  return async function scheduleProductSearchTask(payload: {
    requestId: string;
    search: { keyword: string };
  }) {
    const productSearchEndpoint = String(config.get('productSearch.endpoint'));

    return cloudTask.createTask({
      parent: String(config.get('cloudTasks.productSearchQueue')),
      task: {
        httpRequest: {
          body: Buffer.from(
            JSON.stringify({
              search: payload.search,
            }),
          ).toString('base64'),
          headers: {
            'Content-Type': 'application/json',
            'Request-Id': payload.requestId,
          },
          httpMethod: 'POST',
          oauthToken: ![AppEnvironment.DEV, AppEnvironment.TEST].includes(
            APP_ENV,
          )
            ? {
                serviceAccountEmail: await getInstanceServiceAccount(),
              }
            : null,
          url: productSearchEndpoint,
        },
      },
    });
  };
}
