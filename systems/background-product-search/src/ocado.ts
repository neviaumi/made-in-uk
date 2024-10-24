import { Duplex, Readable } from 'node:stream';

import playwright from 'playwright';

import { closeCookieModals, infiniteScroll } from '@/browser-utils.ts';
import type { Logger } from '@/logger.ts';
import { PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.ocado.com';

export function createProductsSearchHandler(
  page: playwright.Page,
  options?: {
    logger: Logger;
  },
) {
  return async function* searchProducts(keyword: string): AsyncGenerator<
    [
      string,
      {
        productUrl: string;
        source: PRODUCT_SOURCE;
      },
    ]
  > {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const logger = options?.logger;
    const responseStream = new Duplex({
      final() {
        this.push(null);
      },
      objectMode: true,
      read() {},
    });
    const searchUrl = new URL(`/search?entry=${keyword}`, baseUrl);
    searchUrl.searchParams.set('display', '1024');
    await page.goto(searchUrl.toString(), {
      waitUntil: 'domcontentloaded',
    });
    await closeCookieModals(page);
    if (await page.locator('.nf-resourceNotFound').isVisible()) {
      return;
    }
    (async () => {
      const productsAlreadyLoaded = new Set<string>();
      const scrollHeight = await page
        .locator('.main-column [data-sku]:visible', {
          has: page.locator('a[href]'),
        })
        .last()
        .evaluate(ele => {
          return ele.scrollHeight;
        });
      await infiniteScroll(page, {
        scrollHeight: scrollHeight,
        stopScrollCallback: async () => {
          await page
            .locator('.main-column [data-sku]')
            .evaluateAll(elements => {
              return elements.map(element => {
                const anchor = element.querySelector('a[href]');
                if (!anchor) {
                  return null;
                }
                const productId = element.getAttribute('data-sku');
                return [productId, anchor.getAttribute('href')];
              });
            })
            .then(links =>
              links.filter(
                (link): link is string[] =>
                  link !== null && !productsAlreadyLoaded.has(String(link[0])),
              ),
            )
            .then(links => {
              links.forEach(link => {
                responseStream.push(link);
                productsAlreadyLoaded.add(link[0]);
              });
            });
        },
      });
    })().finally(() => {
      responseStream.end();
    });

    for await (const [productId, productUrl] of Readable.from(responseStream)) {
      yield [
        productId,
        {
          productUrl: new URL(productUrl, baseUrl).toString(),
          source: PRODUCT_SOURCE.OCADO,
        },
      ];
    }
  };
}
