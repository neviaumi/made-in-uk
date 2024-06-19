import { CloudTasksClient } from '@google-cloud/tasks';
import { credentials } from '@grpc/grpc-js';
import { GoogleAuth } from 'google-auth-library';

import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';

const config = loadConfig(APP_ENV);

export enum TASK_TYPE {
  FETCH_PRODUCT_DETAIL = 'FETCH_PRODUCT_DETAIL',
  UPDATE_PRODUCT_DETAIL = 'UPDATE_PRODUCT_DETAIL',
}

export const ONE_HOUR = 60 * 60;

export function computeScheduleSeconds(scheduleSound: number) {
  const MAX_SCHEDULE_SECONDS_LIMIT = ONE_HOUR * 24 * 30; // Represents 30 days in seconds.
  return (
    Math.min(scheduleSound, MAX_SCHEDULE_SECONDS_LIMIT) + Date.now() / 1000
  );
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
  return async function scheduleProductDetailTask(
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
      scheduleTime: NonNullable<
        Parameters<CloudTasksClient['createTask']>[0]['task']
      >['scheduleTime'];
    },
  ) {
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
        await idTokenClient.getRequestHeaders(productDetailEndpoint),
      );
    }
    return cloudTask.createTask({
      parent: String(config.get('cloudTasks.productDetailQueue')),
      task: {
        httpRequest: {
          body: Buffer.from(
            JSON.stringify({ product: payload.product, type: payload.type }),
          ).toString('base64'),
          headers,
          httpMethod: 'POST',
          url: productDetailEndpoint,
        },
        name: options.name,
        scheduleTime: options.scheduleTime,
      },
    });
  };
}
