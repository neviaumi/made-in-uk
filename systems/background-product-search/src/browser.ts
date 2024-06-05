import playwright from 'playwright';

import { APP_ENV } from '@/config.ts';
import { createLogger, type Logger } from '@/logger.ts';

const baseUrl = 'https://www.ocado.com';
const defaultLogger = createLogger(APP_ENV);

export function createChromiumBrowser(
  browserLaunchOptions?: playwright.LaunchOptions,
) {
  const chromium = playwright.chromium;
  return chromium.launch(browserLaunchOptions);
}

export function createBrowserPage(browser: playwright.Browser) {
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
    const productsLocator = page.locator('.main-column [data-sku] a[href]');
    const beforeScrollingCount = await productsLocator.count();
    await productsLocator.last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);
    const afterScrollingCount = await productsLocator.count();
    if (afterScrollingCount > beforeScrollingCount) {
      return loopUntilNoMoreProductsLoaded();
    }
    return;
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
      waitUntil: 'networkidle',
    });
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
