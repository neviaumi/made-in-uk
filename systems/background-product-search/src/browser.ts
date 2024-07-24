import playwright from 'playwright';

import { APP_ENV } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';

export const baseUrl = 'https://www.ocado.com';
const defaultLogger = createLogger(APP_ENV);

export function createChromiumBrowser(
  browserLaunchOptions?: playwright.LaunchOptions,
) {
  const chromium = playwright.chromium;
  return chromium.launch(browserLaunchOptions);
}

export function createBrowserPage(
  browser: playwright.Browser | playwright.BrowserContext,
) {
  return (pageOptions?: playwright.BrowserContextOptions) => {
    return browser.newPage(pageOptions);
  };
}

export function closeBrowser(browser: playwright.Browser) {
  return browser.close();
}

export function closePage(page: playwright.Page) {
  return page.close();
}

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
          timeout: 3000,
        },
      )
      .catch(() => {
        return;
      });
    await page
      .locator('.main-column [data-sku]', {
        has: page.locator('a[href]'),
      })
      .last()
      .evaluate(ele => {
        ele.scrollIntoView({
          block: 'end',
          inline: 'nearest',
        });
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
  return async function* searchProducts(
    keyword: string,
  ): AsyncGenerator<[string, string]> {
    const searchUrl = new URL(`/search?entry=${keyword}`, baseUrl);
    logger.info(`Searching products that match ${keyword} ...`, {
      searchUrl: searchUrl.toString(),
    });
    await page.goto(searchUrl.toString(), {
      waitUntil: 'domcontentloaded',
    });
    await page
      .getByRole('button', {
        name: 'Accept',
      })
      .click();
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
      if (matchProductUrls.length === 0) {
        break;
      }
      for (const matchProductUrl of matchProductUrls) {
        const [productId, productUrl] = matchProductUrl;
        if (productsAlreadyLoaded.has(productId)) {
          continue;
        }
        productsAlreadyLoaded.add(productId);
        yield [productId, productUrl];
      }
      await loadMoreProducts(page)();
    } while (true);
  };
}
