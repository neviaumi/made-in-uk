import convict from 'convict';

import { Level } from '../logging/logging.constants';
import { AppEnvironment } from './config.constants';

export function configuration() {
  const envSchema = convict({
    env: {
      default: 'development',
      env: 'API_ENV',
      format: Object.values(AppEnvironment),
    },
  });
  envSchema.validate({
    allowed: 'strict',
  });
  const env = envSchema.get('env');
  const shouldUseFirestoreEmulator =
    [AppEnvironment.TEST as string].includes(env) &&
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
      default: env,
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

  return configSchema.getProperties();
}
