import { FieldValue, Firestore } from '@google-cloud/firestore';
import functions from '@google-cloud/functions-framework';

const databaseId = process.env['FIRESTORE_DB'];

if (!databaseId) throw new Error('FIRESTORE_DB environment variable not set.');

const firestore = new Firestore({
  databaseId,
});
const docRef = firestore.collection('count').doc('trigger-count');
await docRef.set({ count: 0 });
functions.cloudEvent('topic-subscriber', async () => {
  await docRef.update({ count: FieldValue.increment(1) });
});
