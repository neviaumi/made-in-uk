import { storage } from '@pulumi/gcp';

import { getProjectRegion } from '../utils/get-project-region.ts';
import { isRunningOnLocal } from '../utils/is-running-on-local.ts';
import { resourceName } from '../utils/resourceName.ts';
import { valueNa } from '../utils/value-na.ts';

export function createCloudStorageForCloudFunction() {
  if (isRunningOnLocal()) {
    return { bucketName: valueNa };
  }
  const bucket = new storage.Bucket(resourceName`cloud-function-bucket`, {
    location: getProjectRegion(),
  });
  return {
    bucketName: bucket.name,
  };
}
