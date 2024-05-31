import { Firestore, type Settings } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';
import type { REPLY_DATA_TYPE } from '@/types.ts';

const config = loadConfig(APP_ENV);
const defaultLogger = createLogger(APP_ENV);

export function createDatabaseConnection(settings?: Settings) {
  const storeConfig = {
    databaseId: config.get('database.id'),
    ...settings,
  };
  return new Firestore(storeConfig);
}

export function createReplyStreamOnDatabase(
  database: Firestore,
  options?: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? defaultLogger;
  return function writeToRepliesStream(
    requestId: string,
    reply:
      | {
          data: any;
          type: REPLY_DATA_TYPE.PRODUCT_DETAIL;
        }
      | {
          error: { code: string; message: string };
          type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_FAILURE;
        },
  ) {
    const collectionPath = `replies.${requestId}`;
    logger.info(`Writing to ${collectionPath}`, {
      reply,
    });
    return database.collection(collectionPath).add(reply);
  };
}
