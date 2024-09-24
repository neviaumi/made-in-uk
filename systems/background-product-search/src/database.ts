import { Duplex } from 'node:stream';

import { Firestore, type Settings, Timestamp } from '@google-cloud/firestore';

import { TASK_STATE } from '@/cloud-task.ts';
import { APP_ENV, loadConfig } from '@/config.ts';
import { withErrorCode } from '@/error.ts';
import {
  PRODUCT_SOURCE,
  REPLY_DATA_TYPE,
  type SearchResultItem,
  SUBTASK_RELY_DATA_TYPE,
} from '@/types.ts';

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
        createdBy: 'background-product-search',
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

export function connectProductSearchCacheOnDatabase(
  database: Firestore,
  source: PRODUCT_SOURCE,
  cacheId: string,
) {
  const cacheDoc = database.collection(`${source}.search`).doc(cacheId);

  return {
    get cachedSearch() {
      return cacheDoc;
    },
    async getCachedSearchData(): Promise<
      | { error: { code: string; message: string }; ok: false }
      | { data: [string, SearchResultItem][]; ok: true }
    > {
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
      try {
        return {
          data: Object.entries(docData['hits']).map(([key, item]) => [
            key,
            Object.assign(item as SearchResultItem, { cached: true }),
          ]),
          ok: true,
        };
      } catch (e) {
        return {
          error: {
            code: 'ERR_CACHE_NOT_FOUND',
            message: `Unexpected empty record for ${cacheId} in caches`,
          },
          ok: false,
        };
      }
    },
    shapeOfCachedProduct(cached: [string, SearchResultItem][]) {
      return {
        expiresAt: Timestamp.fromDate(
          // 3 days
          new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
        ),
        hits: Object.fromEntries(cached),
      };
    },
  };
}

export function connectLockHandlerOnDatabase(
  database: Firestore,
  requestId: string,
  taskId: string,
) {
  const collectionPath = `product-search.request-lock`;

  return {
    async acquireLock() {
      return database
        .collection(collectionPath)
        .doc(taskId)
        .set({
          acquiredAt: Timestamp.now(),
          // lock will expire after 10 minutes
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 10)),

          requestId,
        });
    },
    async checkRequestLockExist() {
      const lock = await database.collection(collectionPath).doc(taskId).get();
      return lock.exists;
    },
    get lock() {
      return database.collection(collectionPath).doc(taskId);
    },
  };
}

export function connectReplyStreamOnDatabase(
  database: Firestore,
  requestId: string,
) {
  return {
    shapeOfReplyStreamItem(
      productInfo:
        | {
            error: {
              code: string | undefined;
              message: string;
              meta?: Record<string, unknown>;
            };
            type: REPLY_DATA_TYPE.SEARCH_PRODUCT_ERROR;
          }
        | {
            data: {
              total: number;
            };
            type: REPLY_DATA_TYPE.SEARCH_PRODUCT;
          },
    ) {
      return productInfo;
    },
    get stream() {
      const collectionPath = `replies.${requestId}`;
      return database.collection(collectionPath).doc('search');
    },
  };
}

export function connectToProductSearchSubTasksReplyStreamOnDatabase(
  database: Firestore,
  requestId: string,
) {
  const collectionPath = `replies.${requestId}`;
  return {
    async closeStream() {
      await database.recursiveDelete(database.collection(collectionPath));
    },
    getRepliesStreamDoc(messageId: string) {
      return database.collection(collectionPath).doc(messageId);
    },
    init() {
      return database.collection(collectionPath).doc('meta').set({
        createdAt: Timestamp.now(),
        createdBy: 'background-product-search',
      });
    },
    shapeOfReplyStreamItem(
      productInfo:
        | {
            error: {
              code: string | undefined;
              message: string;
              meta?: Record<string, unknown>;
            };
            type: SUBTASK_RELY_DATA_TYPE.SEARCH_PRODUCT_ERROR;
          }
        | {
            data: {
              total: number;
            };
            type: SUBTASK_RELY_DATA_TYPE.SEARCH_PRODUCT;
          },
    ) {
      return productInfo;
    },
    subscribe({
      numberOfSubTasksCreated,
    }: {
      numberOfSubTasksCreated: number;
    }) {
      const duplexStream = new Duplex({
        final() {
          this.push(null);
        },
        objectMode: true,
        read() {},
      });
      let docReceivedCount: number = 0;
      const detachDBListener = database
        .collection(collectionPath)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'removed' || change.type === 'modified') return;
            const changedData = change.doc.data();
            if (!changedData['type']) return;
            docReceivedCount += 1;
            duplexStream.push(changedData);
            if (docReceivedCount === numberOfSubTasksCreated) {
              duplexStream.end();
            }
          });
        });
      duplexStream.on('end', () => detachDBListener());
      return duplexStream;
    },
    get totalSearchMatchCount() {
      return (async () => {
        const documents = await Promise.all(
          (await database.collection(collectionPath).listDocuments()).map(doc =>
            doc.get().then(async doc => ({
              data: await doc.data(),
              id: doc.id,
            })),
          ),
        );
        return documents.reduce((acc, doc) => {
          if (!doc.data) {
            throw withErrorCode('ERR_UNEXPECTED_ERROR')(
              new Error('Unexpected empty document'),
            );
          }
          if (doc.id === 'meta') return acc;
          if (doc.data['type'] === SUBTASK_RELY_DATA_TYPE.SEARCH_PRODUCT)
            return acc + doc.data['data']['total'];
        }, 0);
      })();
    },
  };
}

export function connectTokenBucketOnDatabase(database: Firestore) {
  // https://en.wikipedia.org/wiki/Token_bucket
  const collectionPath = `product-search.token-buckets`;
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
          tokens: 1,
        },
        {},
      ); // Expect that function will call every 1 minute , so we can fill 1 token every 1 minute
    },
  };
}
