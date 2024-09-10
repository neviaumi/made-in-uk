import playwright from 'playwright';

import { APP_ENV } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';
import { type Product, PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.zooplus.co.uk/';

async function extractPrice(page: playwright.Page) {
  const priceContainer = page.locator(
    '[data-zta="SelectedArticleBox__TopSection"]',
  );
  const isPriceReduced = !(await priceContainer
    .locator('[data-zta="productStandardPriceAmount"]')
    .first()
    .isVisible());
  if (!isPriceReduced) {
    return {
      price: await priceContainer
        .locator('[data-zta="productStandardPriceAmount"]')
        .first()
        .textContent(),
      pricePerItem: await priceContainer
        .locator('[data-zta="productStandardPriceSuffix"]')
        .first()
        .textContent()
        .then(price =>
          price
            ?.split('/')
            .map(p => p.trim())
            .join('/'),
        ),
    };
  }

  return {
    price: await priceContainer
      .locator('[data-zta="productReducedPriceAmount"]')
      .first()
      .textContent(),
    pricePerItem: await priceContainer
      .locator('[data-zta="productReducedPriceSuffix"]')
      .first()
      .textContent()
      .then(price =>
        price
          ?.split('/')
          .map(p => p.trim())
          .join('/'),
      ),
  };
}

export function createProductDetailsFetcher(
  page: playwright.Page,
  options?: {
    logger: Logger;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    (await page
      .getByRole('button', { name: 'Agree and continue' })
      .isVisible()) &&
      (await page.getByRole('button', { name: 'Agree and continue' }).click());
    const productTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    const image = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content');
    const { price, pricePerItem } = await extractPrice(page);
    return {
      data: {
        countryOfOrigin: 'Unknown',
        id: new URL(page.url()).pathname.split('/').pop()!,
        image: image!,
        price: price!,
        pricePerItem: pricePerItem ?? null,
        source: PRODUCT_SOURCE.ZOOPLUS,
        title: productTitle!,
        type: 'product',
        url: page.url(),
      },
      ok: true,
    };
  };
}
