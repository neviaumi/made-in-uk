import { Duplex } from 'node:stream';

import {
  FieldPath,
  Firestore,
  type Settings,
  Timestamp,
} from '@google-cloud/firestore';

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
  requestedAt: number;
  totalDocsExpected?: number;
}> {
  const collectionPath = `replies.${requestId}`;
  const searchDoc = await database
    .collection(collectionPath)
    .doc('search')
    .get();
  const metaDoc = await database.collection(collectionPath).doc('meta').get();
  if (!metaDoc.exists) {
    throw withErrorCode('ERR_UNEXPECTED_ERROR')(
      createGraphQLError('Meta not found on request stream'),
    );
  }
  const metaData = metaDoc.data();

  if (!metaData) {
    throw withErrorCode('ERR_UNEXPECTED_ERROR')(
      createGraphQLError('Meta not found on request stream'),
    );
  }
  const docsReceived = await database
    .collection(collectionPath)
    .where(FieldPath.documentId(), 'not-in', ['meta', 'search'])
    .count()
    .get()
    .then(count => count.data());
  if (!searchDoc.exists) {
    return {
      completed: false,
      docsReceived: docsReceived.count,
      input: metaData['input'],
      isError: false,
      requestedAt: metaData['createdAt'].toDate().getTime(),
    };
  }
  const searchDocData = searchDoc.data();
  if (!searchDocData) {
    throw withErrorCode('ERR_UNEXPECTED_ERROR')(
      createGraphQLError('Search not found on request stream'),
    );
  }
  if (searchDocData['type'] === 'SEARCH_PRODUCT_ERROR') {
    return {
      completed: false,
      docsReceived: docsReceived.count,
      input: metaData['input'],
      isError: true,
      requestedAt: metaData['createdAt'].toDate().getTime(),
    };
  }

  return {
    completed: docsReceived.count === searchDocData['data']['total'],
    docsReceived: docsReceived.count,
    input: metaData['input'],
    isError: false,
    requestedAt: metaData['createdAt'].toDate().getTime(),
    totalDocsExpected: searchDocData['data']['total'],
  };
}

export async function listUserRequest(
  database: Firestore,
  userId: string,
  operationName: string,
) {
  const docs = await database
    .collection('users')
    .doc(userId)
    .collection('requests')
    .where('operationName', '==', operationName)
    .orderBy('createdAt', 'desc')
    .get();
  return docs.docs.map(doc => doc.id);
}

export function connectToReplyStreamOnDatabase(
  database: Firestore,
  requestId: string,
) {
  const replyCollectionPath = `replies.${requestId}`;
  const userCollectionPath = `users`;

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
      const batch = database.batch();
      batch.set(database.collection(replyCollectionPath).doc('meta'), {
        createdAt: Timestamp.now(),
        createdBy: 'api',
        input,
        operationName,
        requestedBy: userId,
      });
      batch.set(
        database
          .collection(userCollectionPath)
          .doc(userId)
          .collection('requests')
          .doc(requestId),
        {
          createdAt: Timestamp.now(),
          createdBy: 'api',
          operationName,
        },
      );
      await batch.commit();
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
        .collection(replyCollectionPath)
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
  };
}
