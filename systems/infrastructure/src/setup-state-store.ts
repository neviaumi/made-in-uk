/* eslint-disable no-console,n/no-process-exit */

import { Storage } from '@google-cloud/storage';
import { customAlphabet } from 'nanoid';

const [bucketPrefix] = process.argv.slice(2);
if (!bucketPrefix) {
  console.error('Bucket prefix is required');
  process.exit(1);
}
const storage = new Storage({});
const [buckets] = await storage.getBuckets();
const existingBucket = buckets.find(bucket =>
  bucket?.id?.startsWith(bucketPrefix),
);
const isBucketExists = existingBucket !== undefined;
if (isBucketExists) {
  console.log(existingBucket.id);
} else {
  const bucketSuffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789')(
    6,
  ).toLowerCase();
  const bucketName = `${bucketPrefix}-${bucketSuffix}`;
  await storage.createBucket(bucketName);
  console.log(bucketName);
}
