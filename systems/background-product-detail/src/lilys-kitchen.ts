import { type Page } from '@/browser.ts';
import { closeCookieModals } from '@/browser-utils.ts';
import { extractTotalWeight } from '@/llm.ts';
import { type Logger } from '@/logger.ts';
import { type Product, PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.lilyskitchen.co.uk/';
export function createProductDetailsFetcher(
  page: Page,
  options: {
    logger: Logger;
    requestId: string;
  },
) {
  const logger = options.logger;
  return async function fetchProductDetails(productUrl: string): Promise<
    | {
        error: { code: string; message: string; meta: Record<string, unknown> };
        ok: false;
      }
    | { data: Product; ok: true }
  > {
    const fullUrl = new URL(productUrl, baseUrl).toString();
    await page.goto(fullUrl);
    await closeCookieModals(page);

    const productTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    const image = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content');
    const url = await page
      .locator('meta[property="og:url"]')
      .getAttribute('content');

    const productDetail = await page
      .locator('[data-product-details]')
      .first()
      .evaluate(el => JSON.parse(el.getAttribute('data-product-details')!));
    const price = Intl.NumberFormat('en-GB', {
      currency: productDetail['currency'],
      style: 'currency',
    }).format(productDetail['unit_price']);
    const productWeight = await extractTotalWeight(
      {
        description: productTitle!,
      },
      { logger, requestId: options.requestId },
    );
    const pricePerItem =
      productWeight.data.totalWeight === null
        ? null
        : `${Intl.NumberFormat('en-GB', {
            currency: productDetail['currency'],
            style: 'currency',
          }).format(
            productDetail['unit_price'] / productWeight.data.totalWeight,
          )}/${productWeight.data.weightUnit}`;
    return {
      data: {
        countryOfOrigin: 'Unknown',
        id: productDetail['id'],
        image: image!,
        price: price,
        pricePerItem: pricePerItem,
        source: PRODUCT_SOURCE.LILYS_KITCHEN,
        title: productTitle!,
        type: 'product',
        url: url!,
      },
      ok: true,
    };
  };
}
