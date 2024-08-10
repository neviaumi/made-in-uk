import { storage } from '@pulumi/gcp';

import { getLocation } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createCloudStorageBucketForLLM() {
  const bucket = new storage.Bucket(resourceName`llm`, {
    location: getLocation(),
  });
  return {
    bucketName: bucket.name,
  };
}
