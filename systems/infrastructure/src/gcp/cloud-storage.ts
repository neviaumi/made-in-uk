import { storage } from '@pulumi/gcp';

import { getLocation } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createCloudStorageForCloudFunction() {
  const bucket = new storage.Bucket(resourceName`cloud-function-bucket`, {
    location: getLocation(),
  });
  return {
    bucketName: bucket.name,
  };
}
