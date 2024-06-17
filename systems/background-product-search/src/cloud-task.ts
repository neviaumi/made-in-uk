import { CloudTasksClient } from '@google-cloud/tasks';
import { credentials } from '@grpc/grpc-js';
import { GoogleAuth } from 'google-auth-library';

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

export function createProductDetailScheduler(cloudTask: CloudTasksClient) {
  return async function scheduleProductDetailTask(payload: {
    product: { productId: string; productUrl: string; source: string };
    requestId: string;
  }) {
    let headers = {
      'Content-Type': 'application/json',
      'Request-Id': payload.requestId,
    };
    const productDetailEndpoint = String(config.get('productDetail.endpoint'));
    if (![AppEnvironment.DEV, AppEnvironment.TEST].includes(APP_ENV)) {
      const auth = new GoogleAuth();
      const idTokenClient = await auth.getIdTokenClient(productDetailEndpoint);
      headers = Object.assign(
        headers,
        idTokenClient.getRequestHeaders(productDetailEndpoint),
      );
    }
    return cloudTask.createTask({
      parent: String(config.get('cloudTasks.productDetailQueue')),
      task: {
        httpRequest: {
          body: Buffer.from(JSON.stringify(payload.product)).toString('base64'),
          headers,
          httpMethod: 'POST',
          url: productDetailEndpoint,
        },
      },
    });
  };
}
