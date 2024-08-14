import { firestore } from '@pulumi/gcp';

import { getLocation } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createFireStoreDB() {
  const dbRef = new firestore.Database(resourceName`db`, {
    locationId: getLocation(),
    type: 'FIRESTORE_NATIVE',
  });
  new firestore.Field(resourceName`ocado-cache-ttl`, {
    collection: 'ocado.products',
    database: dbRef.name,
    field: 'expiresAt',
    ttlConfig: {},
  });
  return {
    name: dbRef.name,
  };
}
