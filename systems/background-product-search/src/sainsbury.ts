import playwright from 'playwright';

import { APP_ENV } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';
import { PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.sainsburys.co.uk/';
const defaultLogger = createLogger(APP_ENV);

function createSearchNavigator(page: playwright.Page) {
  return async function (keyword: string, pageNumber: number) {
    const searchUrl = new URL(`/gol-ui/SearchResults/${keyword}`, baseUrl);
    searchUrl.searchParams.set('pageNumber', pageNumber.toString());
    await page.goto(searchUrl.toString(), {
      waitUntil: 'domcontentloaded',
    });
    const searchApiUrl = new URL(
      '/groceries-api/gol-services/product/v1/product',
      baseUrl,
    );
    searchApiUrl.searchParams.set('filter[keyword]', keyword);
    searchApiUrl.searchParams.set('page_number', pageNumber.toString());
    searchApiUrl.searchParams.set('page_size', '90');
    await page.goto(searchApiUrl.toString(), {
      waitUntil: 'domcontentloaded',
    });
  };
}

export function createProductsSearchHandler(
  page: playwright.Page,
  options?: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? defaultLogger;
  return async function* searchProducts(keyword: string): AsyncGenerator<
    [
      string,
      {
        productUrl: string;
        source: PRODUCT_SOURCE;
      },
    ]
  > {
    await page.goto(
      new URL(`/gol-ui/SearchResults/${keyword}`, baseUrl).toString(),
      {
        waitUntil: 'domcontentloaded',
      },
    );
    (await page
      .getByRole('button', {
        name: 'Accept all cookies',
      })
      .isVisible()) &&
      (await page.getByRole('button', { name: 'Accept all cookies' }).click());
    if (await page.locator('.si__no-results').isVisible()) {
      return;
    }
    let pageNumber = 1;
    const searchNavigator = createSearchNavigator(page);
    do {
      logger.info(
        `Searching products that match ${keyword} on sainsbury for page ${pageNumber}`,
      );
      const response = await searchNavigator(keyword, pageNumber).then(
        async () => {
          return page.innerText('pre').then(JSON.parse);
        },
      );
      for (const product of response.products) {
        yield [
          product.product_uid,
          {
            productUrl: new URL(product.full_url).pathname,
            source: PRODUCT_SOURCE.SAINSBURY,
          },
        ];
      }
      if (response.controls.page.last > pageNumber) pageNumber += 1;
      else break;
    } while (true);
  };
}
