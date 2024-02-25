import { createServer } from 'node:http';

import { FieldValue, Firestore } from '@google-cloud/firestore';

const databaseId = process.env['API_DATABASE_ID'];
const port = process.env['PORT'] || 8080;
if (!databaseId) throw new Error('environment variable not set.');
const firestore = new Firestore({
  databaseId,
});

const docRef = firestore.collection('count').doc('visit-count');
await docRef.set({ count: 0 });
createServer(async (req, res) => {
  await docRef.update({ count: FieldValue.increment(1) });

  const visitCount = await docRef.get();
  const triggerCount = await firestore
    .collection('count')
    .doc('trigger-count')
    .get();
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      count: visitCount.data()?.count,
      triggerCount: triggerCount.data()?.count,
    }),
  );
}).listen(port);
