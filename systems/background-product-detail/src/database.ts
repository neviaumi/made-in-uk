import { Firestore, type Settings } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';

const config = loadConfig(APP_ENV);

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
  return function cacheProduct(source: string, productId: string) {
    return database.collection(`${source}.products`).doc(productId);
  };
}

export function createLockHandlerOnDatabase(database: Firestore) {
  const collectionPath = `product-detail.request-lock`;

  function formatDocPath(requestId: string, productId: string) {
    return `${requestId}.${productId}`;
  }
  return {
    async acquireLock(requestId: string, productId: string, payload: any) {
      return database
        .collection(collectionPath)
        .doc(formatDocPath(requestId, productId))
        .set(payload);
    },
    async checkRequestLock(requestId: string, productId: string) {
      const lock = await database
        .collection(collectionPath)
        .doc(formatDocPath(requestId, productId))
        .get();
      return lock.exists;
    },
    async releaseLock(requestId: string, productId: string) {
      await database
        .collection(collectionPath)
        .doc(formatDocPath(requestId, productId))
        .delete();
    },
  };
}

export function createReplyStreamOnDatabase(database: Firestore) {
  return function writeToRepliesStream(requestId: string, productId: string) {
    const collectionPath = `replies.${requestId}`;
    return database.collection(collectionPath).doc(productId);
  };
}
