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

export function createProductsSearchHandler(
  page: playwright.Page,
  options?: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? defaultLogger;
  return async function searchProducts(keyword: string): Promise<{
    data: string[];
    ok: true;
  }> {
    const searchUrl = new URL(`/search?entry=${keyword}`, baseUrl);
    logger.info(`Searching products that match ${keyword} ...`, {
      searchUrl: searchUrl.toString(),
    });
    await page.goto(searchUrl.toString());
    const matchProductUrls = await page
      .locator('.main-column [data-sku]')
      .getByRole('link')
      .evaluateAll(elements =>
        elements.map(element => element.getAttribute('href')),
      );
    return {
      data: Array.from(
        new Set(
          matchProductUrls.filter(url =>
            url?.startsWith('/products/'),
          ) as string[],
        ),
      ),
      ok: true,
    };
  };
}
