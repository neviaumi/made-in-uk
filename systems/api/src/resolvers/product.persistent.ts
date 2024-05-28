import { type Firestore } from '@google-cloud/firestore';

import type { Logger } from '@/logging/logger.ts';

import type { Product } from './types';

export function createProductSaver(
  database: Firestore,
  options?: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? console;
  return async function saveProduct(product: Product) {
    logger.info(`Saving product ${product.id} ...`, { product });
    const doc = database.collection('products').doc(product.id);
    return doc.set(product);
  };
}
