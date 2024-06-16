import { storage } from '@pulumi/gcp';

import { getGcpConfig } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createCloudStorageForCloudFunction() {
  const bucket = new storage.Bucket(resourceName`cloud-function-bucket`, {
    location: getGcpConfig(),
  });
  return {
    bucketName: bucket.name,
  };
}
