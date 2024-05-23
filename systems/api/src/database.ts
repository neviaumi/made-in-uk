import { Firestore, type Settings } from '@google-cloud/firestore';

import type { Config } from '@/config.ts';

export function createDatabaseConnection(settings?: Settings) {
  return (config: Config) => {
    const storeConfig = {
      databaseId: config.get('database.id'),
      ...settings,
    };
    return new Firestore(storeConfig);
  };
}
