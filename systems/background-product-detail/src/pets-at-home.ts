import playwright from 'playwright';

import { APP_ENV } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';
import { type Product, PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.petsathome.com';
export function createProductDetailsFetcher(
  page: playwright.Page,
  options?: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? createLogger(APP_ENV);
  return async function fetchProductDetails(productUrl: string): Promise<
    | {
        error: { code: string; message: string; meta: Record<string, unknown> };
        ok: false;
      }
    | { data: Product; ok: true }
  > {
    const fullUrl = new URL(productUrl, baseUrl).toString();
    await page.goto(fullUrl);
    (await page.getByRole('button', { name: 'Allow all' }).isVisible()) &&
      (await page.getByRole('button', { name: 'Allow all' }).click());
    const productTitle = await page.title();
    const image = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content');
    const price = await page
      .locator('[class^="product-price_price"]')
      .first()
      .evaluate(
        el => Array.from(el.childNodes).map(node => node.textContent)[0],
      );
    const pricePerItem = await page
      .locator('[class^="product-price_product-per-unit"]')
      .first()
      .textContent()
      .then(text => text?.slice(1, -1));
    return {
      data: {
        countryOfOrigin: 'Unknown',
        id: new URL(page.url()).pathname.split('/').pop()!,
        image: image!,
        price: price!,
        pricePerItem: pricePerItem ?? null,
        source: PRODUCT_SOURCE.PETS_AT_HOME,
        title: productTitle!,
        type: 'product',
        url: page.url(),
      },
      ok: true,
    };
  };
}
