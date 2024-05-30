import playwright from 'playwright';

import { APP_ENV } from '@/config.ts';
import { createLogger, type Logger } from '@/logging/logger.ts';

import type { Product } from './types';

const baseUrl = 'https://www.ocado.com';

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

export function createProductDetailsHandler(
  page: playwright.Page,
  options?: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? createLogger(APP_ENV);
  return async function getProductDetails(
    productUrl: string,
  ): Promise<null | Product> {
    const fullUrl = new URL(productUrl, baseUrl).toString();
    await page.goto(fullUrl);
    const countryOfOriginHeading = page.getByRole('heading', {
      name: 'Country of Origin',
    });
    const parent = page
      .locator('.gn-content.bop-info__field')
      .filter({ has: countryOfOriginHeading });
    if (!(await parent.isVisible())) {
      logger.warn('Country of origin not found', {
        url: fullUrl,
      });
      return null;
    }
    const countryOfOrigin = await parent
      .locator('.bop-info__content')
      .first()
      .textContent()
      .then(text => text?.trim());
    if (!countryOfOrigin) {
      logger.warn('Country of origin is undefined', {
        url: fullUrl,
      });
      return null;
    }
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
    const productId = new URL(productOpenGraphMeta['og:url'], baseUrl).pathname
      .split('/')
      .pop();
    if (!productId) {
      logger.warn('Product no open graph meta', {
        productOpenGraphMeta,
        url: fullUrl,
      });
      return null;
    }
    return {
      countryOfOrigin,
      id: productId,
      image: new URL(productOpenGraphMeta['og:image'], baseUrl).toString(),
      title: productOpenGraphMeta['og:title'],
      type: productOpenGraphMeta['og:type'],
      url: new URL(productOpenGraphMeta['og:url'], baseUrl).toString(),
    };
  };
}
