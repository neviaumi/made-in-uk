import convict from 'convict';

import { Level } from '@/logger.types.ts';
import { PRODUCT_SOURCE } from '@/types.ts';

export enum AppEnvironment {
  DEV = 'development',
  PRD = 'production',
  TEST = 'test',
}

export const APP_ENV: AppEnvironment = process.env[
  'BG_PRODUCT_DETAIL_ENV'
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
        Invalid BG_PRODUCT_DETAIL_ENV value: ${APP_ENV}
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
        env: 'BG_PRODUCT_DETAIL_SAINSBURY_PRODUCT_DETAIL_QUEUE',
        format: String,
      },
    },
    [PRODUCT_SOURCE.OCADO]: {
      queueName: {
        default: null,
        env: 'BG_PRODUCT_DETAIL_OCADO_PRODUCT_DETAIL_QUEUE',
        format: String,
      },
    },
    [PRODUCT_SOURCE.ZOOPLUS]: {
      queueName: {
        default: null,
        env: 'BG_PRODUCT_DETAIL_ZOOPLUS_PRODUCT_DETAIL_QUEUE',
        format: String,
      },
    },
    [PRODUCT_SOURCE.LILYS_KITCHEN]: {
      queueName: {
        default: null,
        env: 'BG_PRODUCT_DETAIL_LILYS_KITCHEN_PRODUCT_DETAIL_QUEUE',
        format: String,
      },
    },
    [PRODUCT_SOURCE.PETS_AT_HOME]: {
      queueName: {
        default: null,
        env: 'BG_PRODUCT_DETAIL_PETS_AT_HOME_PRODUCT_DETAIL_QUEUE',
        format: String,
      },
    },
    [PRODUCT_SOURCE.VET_SHOP]: {
      queueName: {
        default: null,
        env: 'BG_PRODUCT_DETAIL_VET_SHOP_PRODUCT_DETAIL_QUEUE',
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
        env: 'BG_PRODUCT_DETAIL_DATABASE_ID',
        format: String,
      },
    },
    env: {
      default: appEnv,
    },
    llm: {
      endpoint: {
        default: null,
        env: 'BG_PRODUCT_DETAIL_LLM_ENDPOINT',
        format: String,
      },
    },
    log: {
      level: {
        default: Level.info,
        env: 'BG_PRODUCT_DETAIL_LOG_LEVEL',
        format: Object.values(Level),
      },
    },
    port: {
      default: 5333,
      env: 'BG_PRODUCT_DETAIL_PORT',
      format: 'port',
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
