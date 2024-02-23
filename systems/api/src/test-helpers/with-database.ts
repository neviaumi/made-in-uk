import * as process from 'node:process';

import { Firestore } from '@google-cloud/firestore';
import { beforeEach } from '@jest/globals';
import { TestingModuleBuilder } from '@nestjs/testing';

import { DatabaseConnection } from '../database/database.module';

function cleanupCollection(firestore: Firestore, collectionName: string) {
  const query = firestore.collection(collectionName).limit(1024);
  return async function deleteDocuments() {
    const snapshot = await query.get();
    const batch = firestore.batch();
    const batchSize = snapshot.size;
    if (batchSize === 0) {
      return;
    }
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    return deleteDocuments();
  };
}

export function withDatabaseCleanup(testCollectionName: string) {
  const databaseId = process.env['API_DATABASE_ID'];
  if (!databaseId) {
    throw new Error('API_DATABASE_ID is required');
  }
  const firestore = new Firestore({
    databaseId,
  });
  beforeEach(async () => {
    await cleanupCollection(firestore, `test-${testCollectionName}`)();
  });
  return firestore;
}

export function withDatabase(testCollectionName: string) {
  const databaseId = process.env['API_DATABASE_ID'];
  if (!databaseId) {
    throw new Error('API_DATABASE_ID is required');
  }
  const firestore = new Firestore({
    databaseId,
  });
  return (modBuilder: TestingModuleBuilder) => {
    modBuilder.overrideProvider(DatabaseConnection).useValue({
      proxy: () => ({
        ...firestore,
        collection: () => {
          return firestore.collection(`test-${testCollectionName}`);
        },
      }),
    });
    return modBuilder;
  };
}
