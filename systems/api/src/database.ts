import { Duplex, Readable } from 'node:stream';

import { Firestore, type Settings } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';

const config = loadConfig(APP_ENV);

export function createDatabaseConnection(settings?: Settings) {
  const storeConfig = {
    databaseId: config.get('database.id'),
    ...settings,
  };
  return new Firestore(storeConfig);
}

export function handleStreamHeader(stream: Duplex) {
  return function writeHeaderToStream(
    change: FirebaseFirestore.DocumentChange,
  ) {
    const changedData = change.doc.data();
    const isCompleted = changedData['type'] !== 'PRODUCT_SEARCH_LOCK';
    if (!isCompleted) return null;
    const content = changedData['data'];
    if (changedData['type'] === 'PRODUCT_SEARCH_ERROR') {
      stream.end();
      throw new Error(content.error.message);
    }
    const total: number = content['total'];
    const hasNoData = total === 0;
    if (hasNoData) {
      stream.end();
    }
    return total;
  };
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

export function createListenerToReplyStreamData(
  database: Firestore,
  options?: {
    logger?: Logger;
  },
) {
  const logger = options?.logger ?? createLogger(APP_ENV);
  return function listenToReplyStreamData(requestId: string) {
    const collectionPath = `replies.${requestId}`;
    const duplexStream = new Duplex({
      final() {
        this.push(null);
      },
      objectMode: true,
      read() {},
    });
    let totalDocsExpected: number = 0;
    let docReceivedCount: number = 0;
    const detachDBListener = database
      .collection(collectionPath)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'removed') return;
          const isHeader = change.doc.id === 'headers';
          if (isHeader) {
            const headerTotal = handleStreamHeader(duplexStream)(change);
            if (headerTotal !== null) {
              logger.info(
                `Update total from ${totalDocsExpected} to ${headerTotal}`,
                { headerTotal, totalDocsExpected },
              );
              totalDocsExpected = headerTotal;
            }
            return;
          }
          const changedData = change.doc.data();
          if (changedData['type'] === 'FETCH_PRODUCT_DETAIL_LOCK') {
            return;
          }
          docReceivedCount += 1;
          duplexStream.push(changedData);
          if (docReceivedCount === totalDocsExpected) {
            duplexStream.end();
          }
        });
      });
    duplexStream.on('end', () => detachDBListener());
    return Readable.from(duplexStream);
  };
}
