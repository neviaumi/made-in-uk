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

function loopUntilAllProductsLoaded(page: playwright.Page) {
  return async function loopUntilNoMoreProductsLoaded() {
    const currentScrollY = await page.evaluate(() => window.scrollY);
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
          timeout: 5000,
        },
      )
      .catch(async e => {
        if ((await page.evaluate(() => window.scrollY)) !== currentScrollY) {
          return;
        }
        throw e;
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

    try {
      await waitForResponse;
    } catch {
      return;
    }
    return loopUntilNoMoreProductsLoaded();
  };
}

export function createProductsSearchHandler(
  page: playwright.Page,
  options?: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? defaultLogger;
  return async function searchProducts(keyword: string): Promise<
    | {
        data: {
          [productId: string]: string;
        };
        ok: true;
      }
    | {
        error: {
          code: string;
          message: string;
        };
        ok: false;
      }
  > {
    const searchUrl = new URL(`/search?entry=${keyword}`, baseUrl);
    logger.info(`Searching products that match ${keyword} ...`, {
      searchUrl: searchUrl.toString(),
    });
    await page.goto(searchUrl.toString(), {
      waitUntil: 'domcontentloaded',
    });
    // await page.goto(searchUrl.toString());
    await page
      .getByRole('button', {
        name: 'Accept',
      })
      .click();
    await loopUntilAllProductsLoaded(page)();

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
      .then(links => links.filter((link): link is string[] => link !== null));

    return {
      data: Object.fromEntries(matchProductUrls),
      ok: true as const,
    };
  };
}
