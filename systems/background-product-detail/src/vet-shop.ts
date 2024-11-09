import { type Page } from '@/browser.ts';
import { extractTotalWeight } from '@/llm.ts';
import { type Logger } from '@/logger.ts';
import { type Product, PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.vetshop.co.uk/';

async function extractPricePerItem(
  {
    price,
    productName,
    vetShopWeight,
  }: { price: number; productName: string; vetShopWeight?: number },
  option: { logger: Logger; requestId: string },
) {
  if (isNaN(price)) {
    return null;
  }
  const { data } = await extractTotalWeight(
    { description: productName },
    option,
  );
  const totalWeight = await (async () => {
    if (data.totalWeight) {
      return data.totalWeight;
    }
    // VetShop total weight can be wrong, used as a fell back
    if (!vetShopWeight) {
      return null;
    }
    return vetShopWeight;
  })();
  if (!totalWeight) {
    return null;
  }

  const pricePerItem = `${Intl.NumberFormat('en-GB', {
    currency: 'GBP',
    style: 'currency',
  }).format(price / totalWeight)}/${data.weightUnit}`;
  return pricePerItem;
}

export function createProductDetailsFetcher(
  page: Page,
  options: { logger: Logger; requestId: string },
) {
  return async function fetchProductDetails(productUrl: string): Promise<
    | { data: Product; ok: true }
    | {
        error: { code: string; message: string; meta: Record<string, unknown> };
        ok: false;
      }
  > {
    const logger = options.logger;
    const apiURL = new URL('/api/items', baseUrl);
    apiURL.searchParams.set('c', '3934951');
    apiURL.searchParams.set('country', 'GB');
    apiURL.searchParams.set('currency', 'GBP');
    apiURL.searchParams.set('fieldset', 'details');
    apiURL.searchParams.set('language', 'en');
    apiURL.searchParams.set('url', productUrl);
    const resp = await page
      .goto(apiURL.toString())
      .then(() => page.innerText('pre').then(JSON.parse));
    const product = resp.items?.[0];
    if (!product) {
      return {
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found',
          meta: { productUrl, resp },
        },
        ok: false,
      };
    }
    const productTitle = product.pagetitle;
    const image = (function parseVetShopImage() {
      const imageUrl = product.itemimages_detail.vetshop.urls[0].url;
      if (!imageUrl) {
        throw new Error('Image not found');
      }
      return encodeURI(imageUrl);
    })();
    const url = new URL(productUrl, baseUrl).toString();

    const id = product.itemid;

    const price = product.pricelevel4_formatted;
    logger.info('Process of product page finished on VET_SHOP');

    return {
      data: {
        countryOfOrigin: 'Unknown',
        id: id!,
        image: image!,
        price: price!,
        pricePerItem: await extractPricePerItem(
          {
            price: Number(price!.slice(1)),
            productName: productTitle!,
            vetShopWeight: product.weight,
          },
          options,
        ),
        source: PRODUCT_SOURCE.VET_SHOP,
        title: productTitle!,
        type: 'product',
        url: url!,
      },
      ok: true,
    };
  };
}
