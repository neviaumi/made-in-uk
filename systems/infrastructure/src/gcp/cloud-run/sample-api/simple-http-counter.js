import { createServer } from 'node:http';

import { FieldValue, Firestore } from '@google-cloud/firestore';
import { PubSub } from '@google-cloud/pubsub';

const databaseId = process.env['FIRESTORE_DB'];
const port = process.env['PORT'] || 8080;
const topicId = process.env['TOPIC_ID'];
if (!databaseId || !topicId) throw new Error('environment variable not set.');
const firestore = new Firestore({
  databaseId,
});
const pubsub = new PubSub();

const docRef = firestore.collection('count').doc('visit-count');
await docRef.set({ count: 0 });
createServer(async (req, res) => {
  await docRef.update({ count: FieldValue.increment(1) });
  const topic = pubsub.topic(topicId);
  await topic.publishMessage({
    json: {
      data: '',
      requestId: '12345679',
    },
  });
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
