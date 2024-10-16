import convict from 'convict';

import { Level } from '@/logger.types.ts';
import { PRODUCT_SOURCE } from '@/types.ts';

export enum AppEnvironment {
  DEV = 'development',
  PRD = 'production',
  TEST = 'test',
}

export const APP_ENV: AppEnvironment = process.env[
  'BG_PRODUCT_SEARCH_ENV'
]! as AppEnvironment;

if (
  !(function checkAppEnvValid(
    appEnv: string | undefined,
  ): appEnv is AppEnvironment {
    return (
      appEnv !== undefined &&
      Object.values<string>(AppEnvironment).includes(appEnv)
    );
  })(APP_ENV)
) {
  throw new Error(`
        Invalid BG_PRODUCT_SEARCH_ENV value: ${APP_ENV}
        possible values: ${Object.values<string>(AppEnvironment).join('/ ')}
    `);
}

export function loadConfig(appEnv: AppEnvironment) {
  const shouldUseCloudTasksEmulator =
    [AppEnvironment.TEST, AppEnvironment.DEV].includes(appEnv) &&
    process.env['CLOUD_TASKS_EMULATOR_HOST'] !== undefined;
  const taskQueueConfigs: {
    [key in PRODUCT_SOURCE]: { queueName: convict.SchemaObj<string> };
  } = {
    [PRODUCT_SOURCE.SAINSBURY]: {
      queueName: {
        default: null,
        env: 'BG_PRODUCT_SEARCH_SAINSBURY_PRODUCT_SEARCH_QUEUE',
        format: String,
      },
    },
    [PRODUCT_SOURCE.OCADO]: {
      queueName: {
        default: null,
        env: 'BG_PRODUCT_SEARCH_OCADO_PRODUCT_SEARCH_QUEUE',
        format: String,
      },
    },
  };
  const configSchema = convict({
    cloudTasks: Object.assign(
      {
        emulatorHost: {
          default: shouldUseCloudTasksEmulator ? null : '',
          env: shouldUseCloudTasksEmulator
            ? 'CLOUD_TASKS_EMULATOR_HOST'
            : 'UNUSED',
          format: String,
        },
        productDetailQueue: {
          default: null,
          env: 'BG_PRODUCT_SEARCH_PRODUCT_DETAIL_QUEUE',
          format: String,
        },
        useEmulator: {
          default: shouldUseCloudTasksEmulator,
          format: Boolean,
        },
      },
      taskQueueConfigs,
    ),
    database: {
      id: {
        default: null,
        env: 'BG_PRODUCT_SEARCH_DATABASE_ID',
        format: String,
      },
    },
    env: {
      default: appEnv,
    },
    log: {
      level: {
        default: Level.info,
        env: 'BG_PRODUCT_SEARCH_LOG_LEVEL',
        format: Object.values(Level),
      },
    },
    port: {
      default: 5333,
      env: 'BG_PRODUCT_SEARCH_PORT',
      format: 'port',
    },
    productDetail: {
      endpoint: {
        default: null,
        env: 'BG_PRODUCT_SEARCH_PRODUCT_DETAIL_ENDPOINT',
        format: String,
      },
    },
  });
  if (![AppEnvironment.TEST].includes(appEnv)) {
    configSchema.validate({
      allowed: 'strict',
    });
  }
  return configSchema;
}

export type Config = ReturnType<typeof loadConfig>;
