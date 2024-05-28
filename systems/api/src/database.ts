import { Firestore, type Settings } from '@google-cloud/firestore';

import { loadConfig } from '@/config.ts';
import { APP_ENV } from '@/config/app-env.ts';

const config = loadConfig(APP_ENV);

export function createDatabaseConnection(settings?: Settings) {
  const storeConfig = {
    databaseId: config.get('database.id'),
    ...settings,
  };
  return new Firestore(storeConfig);
}
