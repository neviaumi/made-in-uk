import { firestore } from '@pulumi/gcp';

import { getProjectRegion } from '../utils/get-project-region.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createFireStoreDB() {
  return new firestore.Database(resourceName`my-database`, {
    locationId: getProjectRegion(),
    type: 'FIRESTORE_NATIVE',
  });
}
