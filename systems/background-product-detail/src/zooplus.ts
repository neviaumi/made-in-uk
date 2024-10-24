import { type Page } from '@/browser.ts';
import { closeCookieModals } from '@/browser-utils.ts';
import { APP_ENV } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';
import { type Product, PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.zooplus.co.uk/';

async function extractPrice(page: Page) {
  const priceContainer = page.locator(
    '[data-zta="SelectedArticleBox__TopSection"]',
  );
  const isPriceReduced = !(await priceContainer
    .locator('[data-zta="productStandardPriceAmount"]')
    .first()
    .isVisible());
  const pricePerItemSelector = isPriceReduced
    ? priceContainer.locator('[data-zta="productReducedPriceSuffix"]')
    : priceContainer.locator('[data-zta="productStandardPriceSuffix"]');
  const price = isPriceReduced
    ? priceContainer.locator('[data-zta="productReducedPriceAmount"]')
    : priceContainer.locator('[data-zta="productStandardPriceAmount"]');

  return {
    price: await price.first().textContent(),
    pricePerItem: (await pricePerItemSelector.isVisible())
      ? await pricePerItemSelector
          .first()
          .textContent()
          .then(price =>
            price
              ?.split('/')
              .map(p => p.trim())
              .join('/'),
          )
      : null,
  };
}

export function createProductDetailsFetcher(
  page: Page,
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
    await closeCookieModals(page);
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
