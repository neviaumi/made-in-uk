import { Duplex } from 'node:stream';

import { Firestore, type Settings, Timestamp } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createGraphQLError, withErrorCode } from '@/error.ts';
import { createLogger, type Logger } from '@/logger.ts';

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
    databaseId: config.get('database.id')!,
    ...settings,
  };
  return new Firestore(storeConfig);
}

export function closeReplyStream(
  database: Firestore,
  options?: {
    logger?: Logger;
  },
) {
  const logger = options?.logger ?? createLogger(APP_ENV);

  return async function closeStream(requestId: string) {
    const collectionPath = `replies.${requestId}`;
    await database.recursiveDelete(database.collection(collectionPath));
    logger.info(`Close reply stream ${requestId}`);
  };
}

export async function getRequestStream(
  database: Firestore,
  requestId: string,
): Promise<{
  completed: boolean;
  docsReceived: number;
  input: Record<string, unknown>;
  isError: boolean;
  requestedAt: Date;
  totalDocsExpected?: number;
}> {
  const collectionPath = `replies`;
  const requestStream = await database
    .collection(collectionPath)
    .doc(requestId)
    .get();
  if (!requestStream.exists) {
    throw withErrorCode('ERR_UNEXPECTED_ERROR')(
      createGraphQLError('Request stream not found'),
    );
  }
  const requestStreamData = requestStream.data();

  if (!requestStreamData) {
    throw withErrorCode('ERR_UNEXPECTED_ERROR')(
      createGraphQLError('Request stream.data() not found'),
    );
  }
  const docsReceived = await database
    .collection(collectionPath)
    .doc(requestId)
    .collection('products')
    .count()
    .get()
    .then(count => count.data());
  if (!requestStreamData['search']) {
    return {
      completed: false,
      docsReceived: docsReceived.count,
      input: requestStreamData['input'],
      isError: false,
      requestedAt: requestStreamData['createdAt'].toDate(),
    };
  }
  const searchResult = requestStreamData['search'];
  if (searchResult['type'] === 'SEARCH_PRODUCT_ERROR') {
    return {
      completed: false,
      docsReceived: docsReceived.count,
      input: requestStreamData['input'],
      isError: true,
      requestedAt: requestStreamData['createdAt'].toDate(),
    };
  }

  return {
    completed: docsReceived.count === searchResult['data']['total'],
    docsReceived: docsReceived.count,
    input: requestStreamData['input'],
    isError: false,
    requestedAt: requestStreamData['createdAt'].toDate(),
    totalDocsExpected: searchResult['data']['total'],
  };
}

export async function listUserRequest(
  database: Firestore,
  userId: string,
  operationName: string,
) {
  const docs = await database
    .collection('replies')
    .where('requestedBy', '==', userId)
    .where('operationName', '==', operationName)
    .orderBy('createdAt', 'desc')
    .get();
  return docs.docs.map(doc => doc.id);
}

export function connectToReplyStreamOnDatabase(
  database: Firestore,
  requestId: string,
  { logger }: { logger: Logger },
) {
  return {
    async init({
      input,
      operationName,
      userId,
    }: {
      input?: Record<string, unknown>;
      operationName: string;
      userId: string;
    }) {
      await database.collection('replies').doc(requestId).set({
        createdAt: Timestamp.now(),
        createdBy: 'api',
        input,
        operationName,
        requestedBy: userId,
      });
    },
    listenToReplyStreamData() {
      const duplexStream = new Duplex({
        final() {
          this.push(null);
        },
        objectMode: true,
        read() {},
      });
      const detachDBListener = database
        .collection('replies')
        .doc(requestId)
        .collection('products')
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'removed' || change.type === 'modified') return;
            const changedData = change.doc.data();
            duplexStream.push(changedData);
          });
        });
      duplexStream.on('end', () => detachDBListener());
      return duplexStream;
    },
    async waitForProductSearchResult(): Promise<
      | {
          data: {
            total: number;
          };
          type: 'SEARCH_PRODUCT';
        }
      | {
          error: {
            code: string | undefined;
            message: string;
            meta?: Record<string, unknown>;
          };
          type: 'SEARCH_PRODUCT_ERROR';
        }
    > {
      const requestData = database.collection('replies').doc(requestId);
      const searchData = (await requestData.get()).get('search');
      if (searchData) {
        return searchData;
      }
      return new Promise(resolve => {
        const detachDBListener = database
          .collection('replies')
          .doc(requestId)
          .onSnapshot(async snapshot => {
            const search = snapshot.get('search');
            if (!search) return;
            logger.info('Received product search result', {
              search: search,
            });
            resolve(search);
            detachDBListener();
          });
      });
    },
  };
}
