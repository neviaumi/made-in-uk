import { firestore } from '@pulumi/gcp';

import { getGcpConfig } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createFireStoreDB() {
  const dbRef = new firestore.Database(resourceName`db`, {
    locationId: getGcpConfig(),
    type: 'FIRESTORE_NATIVE',
  });
  return {
    name: dbRef.name,
  };
}
