import convict from 'convict';

import { Level } from '@/logging/logging.constants.ts';

export enum AppEnvironment {
  DEV = 'development',
  PRD = 'production',
  TEST = 'test',
}
export const APP_ENV: AppEnvironment = process.env[
  'API_ENV'
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
        Invalid API_ENV value: ${APP_ENV}
        possible values: ${Object.values<string>(AppEnvironment).join('/ ')}
    `);
}

export function loadConfig(appEnv: AppEnvironment) {
  const shouldUseFirestoreEmulator =
    [AppEnvironment.TEST, AppEnvironment.DEV].includes(appEnv) &&
    process.env['FIRESTORE_EMULATOR_HOST'];
  const configSchema = convict({
    database: {
      id: {
        default: shouldUseFirestoreEmulator ? 'unused' : null,
        env: shouldUseFirestoreEmulator ? 'UNUSED' : 'API_DATABASE_ID',
        format: String,
      },
    },
    env: {
      default: appEnv,
    },
    log: {
      level: {
        default: Level.info,
        env: 'API_LOG_LEVEL',
        format: Object.values(Level),
      },
    },
    port: {
      default: 5333,
      env: 'API_PORT',
      format: 'port',
    },
    pubsub: {
      topics: {
        productSearch: {
          default: null,
          env: 'API_PRODUCT_SEARCH_TOPIC',
          format: String,
        },
      },
    },
  });
  configSchema.validate({
    allowed: 'strict',
  });
  return configSchema;
}

export type Config = ReturnType<typeof loadConfig>;
