import convict from 'convict';

import { AppEnvironment } from '@/config/app-env.ts';
import { Level } from '@/logging/logging.constants.ts';

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
  });
  configSchema.validate({
    allowed: 'strict',
  });
  return configSchema;
}

export type Config = ReturnType<typeof loadConfig>;
