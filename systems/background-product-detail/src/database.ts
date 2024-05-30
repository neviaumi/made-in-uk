import { Firestore, type Settings } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';

const config = loadConfig(APP_ENV);

export function createDatabaseConnection(settings?: Settings) {
  const storeConfig = {
    databaseId: config.get('database.id'),
    ...settings,
  };
  return new Firestore(storeConfig);
}
