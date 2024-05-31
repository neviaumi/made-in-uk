import { Duplex, Readable } from 'node:stream';

import { Firestore, type Settings } from '@google-cloud/firestore';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';

const config = loadConfig(APP_ENV);
const defaultLogger = createLogger(APP_ENV);

export function createDatabaseConnection(settings?: Settings) {
  const storeConfig = {
    databaseId: config.get('database.id'),
    ...settings,
  };
  return new Firestore(storeConfig);
}

export function createListenerToReplyStreamData(
  database: Firestore,
  options?: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? defaultLogger;
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
          if (change.type === 'added') {
            const isHeader = change.doc.id === 'headers';
            const newData = change.doc.data();
            logger.info(`Received data from ${collectionPath}`, {
              data: newData,
              id: change.doc.id,
            });
            if (isHeader) {
              const hasNoData = newData['total'] === 0;
              if (hasNoData) {
                duplexStream.end();
              }
              totalDocsExpected = newData['total'];
            } else {
              docReceivedCount += 1;
              duplexStream.push(newData);
              if (docReceivedCount === totalDocsExpected) {
                duplexStream.end();
              }
            }
          }
        });
      });
    duplexStream.on('end', () => detachDBListener());
    return Readable.from(duplexStream);
  };
}
