import convict from 'convict';

import { Level } from '@/logging/logging.constants.ts';

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
  const shouldUseFirestoreEmulator =
    [AppEnvironment.TEST, AppEnvironment.DEV].includes(appEnv) &&
    process.env['FIRESTORE_EMULATOR_HOST'];
  const configSchema = convict({
    database: {
      id: {
        default: shouldUseFirestoreEmulator ? 'unused' : null,
        env: shouldUseFirestoreEmulator
          ? 'UNUSED'
          : 'BG_PRODUCT_DETAIL_DATABASE_ID',
        format: String,
      },
    },
    env: {
      default: appEnv,
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
  configSchema.validate({
    allowed: 'strict',
  });
  return configSchema;
}

export type Config = ReturnType<typeof loadConfig>;
