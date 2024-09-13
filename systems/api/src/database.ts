import { Duplex } from 'node:stream';

import { Firestore, type Settings } from '@google-cloud/firestore';

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
    databaseId: config.get('database.id'),
    ...settings,
  };
  return new Firestore(storeConfig);
}

export function connectToProductCacheOnDatabase(database: Firestore) {
  return {
    async getCachedProduct(source: string, productId: string) {
      const doc = await database
        .collection(`${source}.products`)
        .doc(productId)
        .get();
      if (!doc.exists) {
        return {
          error: {
            code: 'ERR_PRODUCT_NOT_FOUND',
            message: `Product ${productId} not found in ${source}.products`,
          },
          ok: false,
        };
      }
      const record = doc.data();
      if (!record) {
        return {
          error: {
            code: 'ERR_PRODUCT_NOT_FOUND',
            message: `Unexpected empty record for ${productId} in ${source}.products`,
          },
          ok: false,
        };
      }
      return {
        data: record,
        ok: true,
      };
    },
  };
}

type SteamHeaderHandler = (
  stream: Duplex,
) => (change: FirebaseFirestore.DocumentChange) => number | null;

export function handleNoHeaderStream(stream: Duplex) {
  return function writeHeaderToStream() {
    stream.end();
    throw new Error('No header should be used');
  };
}

export function handleProductStreamHeader(stream: Duplex) {
  return function writeHeaderToStream(
    change: FirebaseFirestore.DocumentChange,
  ) {
    const changedData = change.doc.data();
    const content = changedData['data'];
    if (changedData['type'] === 'PRODUCT_SEARCH_ERROR') {
      stream.end();
      throw new Error(content ? content.error.message : 'Product search error');
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
  streamHeaderHandler: SteamHeaderHandler,
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
            const headerTotal = streamHeaderHandler(duplexStream)(change);
            if (headerTotal !== null) {
              logger.info(
                `Update total from ${totalDocsExpected} to ${headerTotal}`,
                { headerTotal, totalDocsExpected },
              );
              totalDocsExpected = headerTotal;
              if (docReceivedCount === totalDocsExpected) {
                duplexStream.end();
              }
            }
            return;
          }
          const changedData = change.doc.data();
          docReceivedCount += 1;
          duplexStream.push(changedData);
          if (docReceivedCount === totalDocsExpected) {
            duplexStream.end();
          }
        });
      });
    duplexStream.on('end', () => detachDBListener());
    return duplexStream;
  };
}
