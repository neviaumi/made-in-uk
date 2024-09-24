import { Firestore, type Settings, Timestamp } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';
import {
  type Product,
  PRODUCT_SOURCE,
  REPLY_DATA_TYPE,
  TASK_STATE,
} from '@/types.ts';

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
    async getCachedSearchData(): Promise<
      | {
          data: Product;
          ok: true;
        }
      | { error: { code: string; message: string }; ok: false }
    > {
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
        data: docData as Product,
        ok: true,
      };
    },
    shapeOfCachedProduct(product: Product) {
      return Object.assign(product, {
        // 1 day
        expiresAt: Timestamp.fromDate(
          new Date(Date.now() + 1000 * 60 * 60 * 24),
        ),
      });
    },
  };
}

export function createLockHandlerOnDatabase(
  database: Firestore,
  requestId: string,
  taskId: string,
) {
  const collectionPath = `product-detail.request-lock`;

  function formatDocPath() {
    return taskId;
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

          requestId: requestId,
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
    async releaseLock() {
      return database.collection(collectionPath).doc(formatDocPath()).delete();
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
    shapeOfReplyStreamItem(
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
      return productInfo;
    },
  };
}

export function connectTokenBucketOnDatabase(database: Firestore) {
  // https://en.wikipedia.org/wiki/Token_bucket
  const collectionPath = `product-detail.token-buckets`;
  return {
    // @ts-expect-error disable until we have actual usage
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async consume(source: PRODUCT_SOURCE): Promise<{ ok: boolean }> {
      return { ok: true };
      // return database.runTransaction(async transaction => {
      //   const docRef = database.collection(collectionPath).doc(source);
      //   const doc = await transaction.get(docRef);
      //   if (!doc.exists) {
      //     return { ok: false };
      //   }
      //   const docData = doc.data();
      //   if (!docData || !docData['tokens']) {
      //     return { ok: false };
      //   }
      //   if (docData['tokens'] <= 0) {
      //     return { ok: false };
      //   }
      //   transaction.update(docRef, {
      //     tokens: FieldValue.increment(-1),
      //   });
      //   return { ok: true };
      // });
    },
    refill(source: PRODUCT_SOURCE) {
      return database.collection(collectionPath).doc(source).set(
        {
          tokens: 4,
        },
        {},
      ); // Expect that function will call every 1 minute , so we can fill 1 token every 1 minute
    },
  };
}

export function connectTaskStateOnDatabase(
  database: Firestore,
  requestId: string,
  taskId: string,
) {
  const taskStateDoc = database.collection('task-state').doc(taskId);
  return {
    shapeOfTaskStateObject(status: TASK_STATE) {
      return {
        createdAt: Timestamp.fromDate(new Date()),
        createdBy: 'background-product-detail',
        requestId,
        state: status,
      };
    },
    async shouldTaskRun() {
      const doc = await taskStateDoc.get();
      if (!doc.exists) {
        return true;
      }
      const docData = doc.data();
      if (!docData) {
        return true;
      }
      return ![TASK_STATE.DONE, TASK_STATE.ERROR].includes(docData['state']);
    },
    get taskState() {
      return taskStateDoc;
    },
  };
}
