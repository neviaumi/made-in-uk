import playwright from 'playwright';

import { APP_ENV } from '@/config.ts';
import { mapToGenerator, SKIP } from '@/functions/map-to-generators.ts';
import { createLogger, type Logger } from '@/logging/logger.ts';

import type { Product } from './types';

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
  return async function searchProducts(keyword: string) {
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
    return matchProductUrls.filter(url =>
      url?.startsWith('/products/'),
    ) as string[];
  };
}

export function createProductDetailsHandler(page: playwright.Page) {
  return function getProductDetails(productUrls: string[]) {
    return mapToGenerator<Product, string>(async (productUrl: string) => {
      await page.goto(new URL(productUrl, baseUrl).toString());
      const countryOfOriginHeading = page.getByRole('heading', {
        name: 'Country of Origin',
      });
      const parent = page
        .locator('.gn-content.bop-info__field')
        .filter({ has: countryOfOriginHeading });
      if (!(await parent.isVisible())) return SKIP;
      const countryOfOrigin = await parent
        .locator('.bop-info__content')
        .first()
        .textContent()
        .then(text => text?.trim());
      if (!countryOfOrigin) return SKIP;
      const productOpenGraphMeta: {
        'og:image': string;
        'og:title': string;
        'og:type': string;
        'og:url': string;
      } = Object.fromEntries(
        await page
          .locator('meta[property^="og:"]')
          .evaluateAll(elements =>
            elements.map(ele => [
              ele.getAttribute('property'),
              ele.getAttribute('content'),
            ]),
          ),
      );
      const productId = new URL(
        productOpenGraphMeta['og:url'],
        baseUrl,
      ).pathname
        .split('/')
        .pop();
      if (!productId) {
        return SKIP;
      }
      return {
        countryOfOrigin,
        id: productId,
        image: new URL(productOpenGraphMeta['og:image'], baseUrl).toString(),
        title: productOpenGraphMeta['og:title'],
        type: productOpenGraphMeta['og:type'],
        url: new URL(productOpenGraphMeta['og:url'], baseUrl).toString(),
      };
    }, productUrls);
  };
}
