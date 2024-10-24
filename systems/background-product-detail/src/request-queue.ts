import pLimit from 'p-limit';

import {
  closeBrowserPage,
  closeBrowserPool,
  createBrowserPage,
} from '@/browser.ts';
import * as error from '@/error.ts';
import * as lilysKitchen from '@/lilys-kitchen.ts';
import type { Logger } from '@/logger.ts';
import * as ocado from '@/ocado.ts';
import * as petsAtHome from '@/pets-at-home.ts';
import * as sainsbury from '@/sainsbury.ts';
import { type Product, PRODUCT_SOURCE } from '@/types.ts';
import * as vetShop from '@/vet-shop.ts';
import * as zooplus from '@/zooplus.ts';

type ProductDetailRequest = {
  options: {
    logger: Logger;
  };
  productId: string;
  productUrl: string;
  requestId: string;
  source: PRODUCT_SOURCE;
};
const limit = pLimit(4);
export async function processRequest(
  request: ProductDetailRequest,
): Promise<Product> {
  const {
    options: { logger },
    productId,
    productUrl,
    requestId,
    source,
  } = request;
  return limit(async () => {
    const page = await createBrowserPage()();
    const fetchers: {
      [key in PRODUCT_SOURCE]: {
        createProductDetailsFetcher: typeof ocado.createProductDetailsFetcher;
      };
    } = {
      [PRODUCT_SOURCE.LILYS_KITCHEN]: lilysKitchen,
      [PRODUCT_SOURCE.OCADO]: ocado,
      [PRODUCT_SOURCE.PETS_AT_HOME]: petsAtHome,
      [PRODUCT_SOURCE.ZOOPLUS]: zooplus,
      [PRODUCT_SOURCE.VET_SHOP]: vetShop,
      [PRODUCT_SOURCE.SAINSBURY]: sainsbury,
    };
    const productInfo = await fetchers[source]
      .createProductDetailsFetcher(page, {
        logger: logger,
        requestId: requestId,
      })(productUrl)
      .finally(async () => {
        logger.info(`Closing the browser for ${productId} on ${source}`);
        await closeBrowserPage(page);
      });
    if (!productInfo.ok) {
      throw error.withHTTPError(500, 'Failed to fetch product details', {
        retryAble: true,
      })(
        error.withErrorCode('ERR_UNEXPECTED_ERROR')(
          new Error('Failed to fetch product details'),
        ),
      );
    }
    return productInfo.data;
  });
}
export function destroy() {
  return closeBrowserPool();
}
