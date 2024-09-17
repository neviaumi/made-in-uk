import {
  FieldValue,
  Firestore,
  type Settings,
  Timestamp,
} from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';

export { Timestamp } from '@google-cloud/firestore';

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

export function connectProductSearchCacheOnDatabase(
  database: Firestore,
  source: string,
  cacheId: string,
) {
  const cacheDoc = database.collection(`${source}.search`).doc(cacheId);

  return {
    get cachedSearch() {
      return cacheDoc;
    },
    async getCachedSearchData() {
      const doc = await cacheDoc.get();
      if (!doc.exists) {
        return {
          error: {
            code: 'ERR_CACHE_NOT_FOUND',
            message: `Cache ${cacheId} not found in caches`,
          },
          ok: false,
        };
      }
      const docData = doc.data();
      if (!docData || !docData['hits']) {
        return {
          error: {
            code: 'ERR_CACHE_NOT_FOUND',
            message: `Unexpected empty record for ${cacheId} in caches`,
          },
          ok: false,
        };
      }
      return {
        data: docData['hits'],
        ok: true,
      };
    },
  };
}

export function connectLockHandlerOnDatabase(
  database: Firestore,
  requestId: string,
) {
  const collectionPath = `product-search.request-lock`;

  return {
    async acquireLock() {
      return database
        .collection(collectionPath)
        .doc(requestId)
        .set({
          acquiredAt: Timestamp.now(),
          // lock will expire after 10 minutes
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 10)),
        });
    },
    async checkRequestLockExist() {
      const lock = await database
        .collection(collectionPath)
        .doc(requestId)
        .get();
      return lock.exists;
    },
    get lock() {
      return database.collection(collectionPath).doc(requestId);
    },
    async releaseLock() {
      return database.collection(collectionPath).doc(requestId).delete();
    },
  };
}

export function connectReplyStreamOnDatabase(
  database: Firestore,
  requestId: string,
) {
  return {
    get repliesStreamHeader() {
      const collectionPath = `replies.${requestId}`;
      return database.collection(collectionPath).doc('headers');
    },
  };
}

export function connectTokenBucketOnDatabase(database: Firestore) {
  // https://en.wikipedia.org/wiki/Token_bucket
  const collectionPath = `token-buckets`;
  return {
    async consume(source: 'OCADO'): Promise<{ ok: boolean }> {
      return database.runTransaction(async transaction => {
        const docRef = database.collection(collectionPath).doc(source);
        const doc = await transaction.get(docRef);
        if (!doc.exists) {
          return { ok: false };
        }
        const docData = doc.data();
        if (!docData || !docData['tokens']) {
          return { ok: false };
        }
        if (docData['tokens'] <= 0) {
          return { ok: false };
        }
        transaction.update(docRef, {
          tokens: FieldValue.increment(-1),
        });
        return { ok: true };
      });
    },
    refill(source: 'OCADO') {
      return database.collection(collectionPath).doc(source).set(
        {
          tokens: 1,
        },
        {},
      ); // Expect that function will call every 1 minute , so we can fill 1 token every 1 minute
    },
  };
}
