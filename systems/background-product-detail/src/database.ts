import { Firestore, type Settings, Timestamp } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';
import { type Product, REPLY_DATA_TYPE } from '@/types.ts';

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

export function connectProductCacheOnDatabase(
  database: Firestore,
  source: string,
  productId: string,
) {
  const cacheDoc = database.collection(`${source}.products`).doc(productId);
  return {
    get cachedProduct() {
      return cacheDoc;
    },
    async getCachedSearchData() {
      const doc = await cacheDoc.get();
      if (!doc.exists) {
        return {
          error: {
            code: 'ERR_CACHE_NOT_FOUND',
            message: `Cache ${productId} not found in caches`,
          },
          ok: false,
        };
      }
      const docData = doc.data();
      if (!docData) {
        return {
          error: {
            code: 'ERR_CACHE_NOT_FOUND',
            message: `Unexpected empty record for ${productId} in caches`,
          },
          ok: false,
        };
      }
      return {
        data: docData,
        ok: true,
      };
    },
  };
}

export function createLockHandlerOnDatabase(
  database: Firestore,
  requestId: string,
  productId: string,
) {
  const collectionPath = `product-detail.request-lock`;

  function formatDocPath() {
    return `${requestId}.${productId}`;
  }
  return {
    async acquireLock() {
      return database
        .collection(collectionPath)
        .doc(formatDocPath())
        .set({
          acquiredAt: Timestamp.fromDate(new Date()),
          // lock will expire after 10 minutes
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 10)),
        });
    },
    async checkRequestLockExist() {
      const lock = await database
        .collection(collectionPath)
        .doc(formatDocPath())
        .get();
      return lock.exists;
    },
    get lock() {
      return database.collection(collectionPath).doc(formatDocPath());
    },
  };
}

export function connectReplyStreamOnDatabase(
  database: Firestore,
  requestId: string,
  productId: string,
) {
  return {
    get repliesStream() {
      const collectionPath = `replies.${requestId}`;
      return database.collection(collectionPath).doc(productId);
    },
    writeProductInfoToStream(
      productInfo:
        | {
            error: {
              code: string;
              message: string;
              meta: Record<string, unknown>;
            };
            type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL_FAILURE;
          }
        | {
            data: Product;
            type: REPLY_DATA_TYPE.FETCH_PRODUCT_DETAIL;
          },
    ) {
      return database
        .collection(`replies.${requestId}`)
        .doc(productId)
        .set(productInfo);
    },
  };
}
