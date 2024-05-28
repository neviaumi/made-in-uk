import { firestore } from '@pulumi/gcp';
import pulumi from '@pulumi/pulumi';

import { getProjectRegion } from '../utils/get-project-region.ts';
import { isRunningOnLocal } from '../utils/is-running-on-local.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createFireStoreDB() {
  if (isRunningOnLocal()) {
    return { name: pulumi.Output.create('unused') };
  }
  const dbRef = new firestore.Database(resourceName`db`, {
    locationId: getProjectRegion(),
    type: 'FIRESTORE_NATIVE',
  });
  return {
    name: dbRef.name,
  };
}
