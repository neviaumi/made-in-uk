import { Duplex } from 'node:stream';

import { Firestore, type Settings, Timestamp } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';
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

export function connectToReplyStreamOnDatabase(
  database: Firestore,
  requestId: string,
) {
  const collectionPath = `replies.${requestId}`;

  return {
    init() {
      return database.collection(collectionPath).doc('meta').set({
        createdAt: Timestamp.now(),
        createdBy: 'api',
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
        .collection(collectionPath)
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
