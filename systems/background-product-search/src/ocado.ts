import playwright from 'playwright';

import { APP_ENV } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';
import { PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.ocado.com';
const defaultLogger = createLogger(APP_ENV);

function loadMoreProducts(page: playwright.Page) {
  return async function loadMoreProducts() {
    const waitForResponse = page
      .waitForResponse(
        response => {
          const requestUrl = new URL(response.url());
          const plainRequestUrl = new URL(
            requestUrl.pathname,
            requestUrl.origin,
          );
          return (
            plainRequestUrl.toString() ===
            new URL('/webshop/api/v1/products', baseUrl).toString()
          );
        },
        {
          timeout: Math.pow(2, 2) * 1000,
        },
      )
      .catch(() => {
        return;
      });
    await page
      .locator('.main-column [data-sku]:visible', {
        has: page.locator('a[href]'),
      })
      .last()
      .evaluate(ele => {
        window.scrollBy(0, ele.scrollHeight);
      });

    await waitForResponse;
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
        source: PRODUCT_SOURCE.OCADO;
      },
    ]
  > {
    const searchUrl = new URL(`/search?entry=${keyword}`, baseUrl);
    searchUrl.searchParams.set('display', '1024');
    let loadMorePageAttempt = 0;
    logger.info(`Searching products that match ${keyword} ...`, {
      searchUrl: searchUrl.toString(),
    });
    await page.goto(searchUrl.toString(), {
      waitUntil: 'domcontentloaded',
    });
    (await page
      .getByRole('button', {
        name: 'Accept',
      })
      .isVisible()) &&
      (await page.getByRole('button', { name: 'Accept' }).click());
    if (await page.locator('.nf-resourceNotFound').isVisible()) {
      return;
    }
    const totalProductNumber = Number(
      await page
        .locator('.total-product-number')
        .first()
        .innerText()
        .then(text => text.split(' ')[0]),
    );
    if (isNaN(totalProductNumber)) {
      throw new Error('Unexpected total product number');
    }
    const productsAlreadyLoaded = new Set<string>();

    do {
      const matchProductUrls = await page
        .locator('.main-column [data-sku]')
        .evaluateAll(elements => {
          return elements.map(element => {
            const anchor = element.querySelector('a[href]');
            if (!anchor) {
              return null;
            }
            const productId = element.getAttribute('data-sku')!;
            return [productId, anchor.getAttribute('href')!];
          });
        })
        .then(links =>
          links.filter(
            (link): link is string[] =>
              link !== null && !productsAlreadyLoaded.has(link[0]),
          ),
        );
      if (matchProductUrls.length !== 0) {
        loadMorePageAttempt = 0;
      }
      for (const matchProductUrl of matchProductUrls) {
        const [productId, productUrl] = matchProductUrl;
        if (productsAlreadyLoaded.has(productId)) {
          continue;
        }
        productsAlreadyLoaded.add(productId);
        yield [
          productId,
          {
            productUrl: new URL(productUrl, baseUrl).toString(),
            source: PRODUCT_SOURCE.OCADO,
          },
        ];
      }
      if (
        productsAlreadyLoaded.size >= totalProductNumber ||
        loadMorePageAttempt > 16
      ) {
        break;
      }
      await loadMoreProducts(page)();
      loadMorePageAttempt += 1;
    } while (true);
  };
}
