import { Firestore, type Settings } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';
import { REPLY_DATA_TYPE } from '@/types.ts';

const config = loadConfig(APP_ENV);
const defaultLogger = createLogger(APP_ENV);
export function databaseHealthCheck(database: Firestore) {
  return async function healthCheckByGetCollectionInfo(): Promise<
    | {
        ok: true;
      }
    | {
        error: {
          code: string;
          message: string;
        };
        ok: false;
      }
  > {
    return database
      .listCollections()
      .then(() => ({
        ok: true as const,
      }))
      .catch(e => ({
        error: {
          code: 'ERR_DATABASE_HEALTH_CHECK_FAILED',
          message: e.message,
        },
        ok: false,
      }));
  };
}

export function createDatabaseConnection(settings?: Settings) {
  const storeConfig = {
    databaseId: config.get('database.id'),
    ...settings,
  };
  return new Firestore(storeConfig);
}

export function connectToProductDatabase(database: Firestore) {
  return {
    async getProductOrFail(source: string, productId: string) {
      const doc = await database
        .collection(`${source}.products`)
        .doc(productId)
        .get();
      if (!doc.exists) {
        throw new Error(`Product ${productId} not found`);
      }
      const record = doc.data();
      if (!record) {
        throw new Error(
          `Unexpected empty record for ${productId} in ${source}.products`,
        );
      }
      return record;
    },
  };
}

export function connectReplyStreamOnDatabase(
  database: Firestore,
  options: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? defaultLogger;
  return {
    async checkRequestAlreadyExist(requestId: string) {
      const collectionPath = `replies.${requestId}`;
      const headers = await database
        .collection(collectionPath)
        .doc('headers')
        .get();
      return headers.exists;
    },
    writeToRepliesStream(
      requestId: string,
      productId: string,
      reply: {
        data: any;
        type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL;
      },
    ) {
      const collectionPath = `replies.${requestId}`;
      return database.collection(collectionPath).doc(productId).set(reply);
    },
    writeToRepliesStreamHeader(
      requestId: string,
      headers:
        | {
            type: REPLY_DATA_TYPE.PRODUCT_SEARCH_LOCK;
          }
        | {
            error?: {
              code: string;
              message: string;
            };
            search: {
              keyword: string;
            };
            type: REPLY_DATA_TYPE.PRODUCT_SEARCH_ERROR;
          }
        | {
            data: { total: number };
            search: {
              keyword: string;
            };
            type: REPLY_DATA_TYPE.PRODUCT_SEARCH;
          },
    ) {
      const collectionPath = `replies.${requestId}`;
      logger.info(`Set header to ${collectionPath}`, {
        headers,
      });
      return database.collection(collectionPath).doc('headers').set(headers);
    },
  };
}
