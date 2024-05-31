import { Firestore, type Settings } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';
import { REPLY_DATA_TYPE } from '@/types.ts';

const config = loadConfig(APP_ENV);
const defaultLogger = createLogger(APP_ENV);

export function createDatabaseConnection(settings?: Settings) {
  const storeConfig = {
    databaseId: config.get('database.id'),
    ...settings,
  };
  return new Firestore(storeConfig);
}

export function connectReplyStreamOnDatabase(
  database: Firestore,
  options: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? defaultLogger;
  return function writeToRepliesStreamHeader(requestId: string, headers: {}) {
    const collectionPath = `replies.${requestId}`;
    logger.info(`Set header to ${collectionPath}`, {
      headers,
    });
    return database.collection(collectionPath).doc('headers').set(headers);
  };
}
