import { storage } from '@pulumi/gcp';

import { getProjectRegion } from '../utils/get-project-region.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createCloudStorageForCloudFunction() {
  const bucket = new storage.Bucket(resourceName`cloud-function-bucket`, {
    location: getProjectRegion(),
  });
  return {
    bucketName: bucket.name,
  };
}
