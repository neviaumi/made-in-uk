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

export function checkRequestStreamOnDatabase(database: Firestore) {
  return async function checkRequestAlreadyExist(
    requestId: string,
    productId: string,
  ) {
    const collectionPath = `replies.${requestId}`;
    const headers = await database
      .collection(collectionPath)
      .doc(productId)
      .get();
    return headers.exists;
  };
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
    productId: string,
    reply:
      | {
          type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_LOCK;
        }
      | {
          data: any;
          type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL;
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
    return database.collection(collectionPath).doc(productId).set(reply);
  };
}
