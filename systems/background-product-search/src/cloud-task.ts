import { CloudTasksClient } from '@google-cloud/tasks';
import { credentials } from '@grpc/grpc-js';

import { getInstanceServiceAccount } from '@/cloud-run.ts';
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
      scheduleTime?: NonNullable<
        Parameters<CloudTasksClient['createTask']>[0]['task']
      >['scheduleTime'];
    },
  ) {
    const headers = {
      'Content-Type': 'application/json',
      'Request-Id': payload.requestId,
    };
    const productDetailEndpoint = String(config.get('productDetail.endpoint'));
    return cloudTask.createTask({
      parent: String(config.get('cloudTasks.productDetailQueue')),
      task: {
        httpRequest: {
          body: Buffer.from(
            JSON.stringify({ product: payload.product, type: payload.type }),
          ).toString('base64'),
          headers,
          httpMethod: 'POST',
          oidcToken: ![AppEnvironment.DEV, AppEnvironment.TEST].includes(
            APP_ENV,
          )
            ? {
                serviceAccountEmail: await getInstanceServiceAccount(),
              }
            : null,
          url: productDetailEndpoint,
        },
        name: options.name,
        scheduleTime: options.scheduleTime,
      },
    });
  };
}

export function withTaskAlreadyExistsErrorHandler(
  scheduleProductDetailTask: ReturnType<typeof createProductDetailScheduler>,
) {
  return async function scheduleTaskWithErrorHandle(
    ...args: Parameters<ReturnType<typeof createProductDetailScheduler>>
  ) {
    try {
      return await scheduleProductDetailTask(...args);
    } catch (e) {
      if (
        ((obj: typeof e): obj is { code: number } => !isNaN((obj as any).code))(
          e,
        ) &&
        e.code === 6
      ) {
        return;
      }
      throw e;
    }
  };
}
