import { firestore } from '@pulumi/gcp';

import { getLocation } from '../utils/get-gcp-config.ts';
import { resourceName } from '../utils/resourceName.ts';

export function createFireStoreDB() {
  const dbRef = new firestore.Database(resourceName`db`, {
    locationId: getLocation(),
    type: 'FIRESTORE_NATIVE',
  });
  new firestore.Field(resourceName`product-search-lock-ttl`, {
    collection: 'product-search.request-lock',
    database: dbRef.name,
    field: 'expiresAt',
    ttlConfig: {},
  });
  new firestore.Field(resourceName`product-detail-lock-ttl`, {
    collection: 'product-detail.request-lock',
    database: dbRef.name,
    field: 'expiresAt',
    ttlConfig: {},
  });
  new firestore.Field(resourceName`ocado-search-cache-ttl`, {
    collection: 'OCADO.search',
    database: dbRef.name,
    field: 'expiresAt',
    ttlConfig: {},
  });
  new firestore.Field(resourceName`ocado-cache-ttl`, {
    collection: 'OCADO.products',
    database: dbRef.name,
    field: 'expiresAt',
    ttlConfig: {},
  });
  new firestore.Field(resourceName`lilys-kitchen-cache-ttl`, {
    collection: 'LILYS_KITCHEN.products',
    database: dbRef.name,
    field: 'expiresAt',
    ttlConfig: {},
  });
  new firestore.Field(resourceName`pets-at-home-cache-ttl`, {
    collection: 'PETS_AT_HOME.products',
    database: dbRef.name,
    field: 'expiresAt',
    ttlConfig: {},
  });
  new firestore.Field(resourceName`zooplus-cache-ttl`, {
    collection: 'ZOOPLUS.products',
    database: dbRef.name,
    field: 'expiresAt',
    ttlConfig: {},
  });
  new firestore.Field(resourceName`vet-shop-cache-ttl`, {
    collection: 'VET_SHOP.products',
    database: dbRef.name,
    field: 'expiresAt',
    ttlConfig: {},
  });
  return {
    name: dbRef.name,
  };
}
