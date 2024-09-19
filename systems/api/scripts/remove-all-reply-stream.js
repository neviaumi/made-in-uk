import { Firestore } from '@google-cloud/firestore';

const database = new Firestore({
  databaseId: 'made-in-uk-development-db-5840b59',
});

const repliesSteams = await database
  .listCollections()
  .then(coll => coll.map(c => c.id).filter(c => c.startsWith('replies')));

for (const collectionPath of repliesSteams) {
  await database.recursiveDelete(database.collection(collectionPath));
}
