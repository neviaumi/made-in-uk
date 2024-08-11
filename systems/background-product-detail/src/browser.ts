import playwright from 'playwright';

import { APP_ENV } from '@/config.ts';
import { extractCountryFromAddress } from '@/llm.ts';
import { createLogger, type Logger } from '@/logger.ts';

import type { Product } from './types.ts';

export const baseUrl = 'https://www.ocado.com';

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

async function lookupCountryOfOrigin(page: playwright.Page, logger: Logger) {
  const countryOfOriginContainer = page
    .locator('.gn-content.bop-info__field')
    .filter({
      has: page.getByRole('heading', {
        name: 'Country of Origin',
      }),
    });
  const countryOfOrigin = (await countryOfOriginContainer.isVisible())
    ? await countryOfOriginContainer
        .locator('.bop-info__content')
        .first()
        .textContent()
        .then(text => text?.trim() ?? 'Unknown')
    : 'Unknown';
  if (countryOfOrigin !== 'Unknown') return countryOfOrigin;
  const fallbackAddress: Array<[string, string]> = [
    [
      'manufacture',
      await (async () => {
        const brandDetailsButton = page.getByRole('button', {
          name: /^Brand details/i,
        });
        const manufacturerContainer = page
          .locator('.gn-content.bop-info__field')
          .filter({
            has: page.getByRole('heading', {
              name: 'Manufacturer',
            }),
          });
        if (!(await brandDetailsButton.isVisible())) return 'Unknown';
        await brandDetailsButton.first().click();

        return (await manufacturerContainer.isVisible())
          ? await manufacturerContainer
              .locator('.bop-info__content')
              .first()
              .textContent()
              .then(text => text?.trim() ?? 'Unknown')
          : 'Unknown';
      })(),
    ],
  ];
  for (const [, value] of fallbackAddress) {
    if (value !== 'Unknown') {
      const {
        data: { extractedCountry, withInUK },
        raw,
      } = await extractCountryFromAddress(value, logger);
      if (extractedCountry && extractedCountry !== 'Unknown') {
        return String(extractedCountry);
      }
      logger.warn(`Unable parse given address`, {
        address: value,
        extractedCountry,
        generatedContent: raw,
        withInUK,
      });
    }
  }
  return countryOfOrigin;
}

export function createProductDetailsHandler(
  page: playwright.Page,
  options?: {
    logger: Logger;
  },
) {
  const logger = options?.logger ?? createLogger(APP_ENV);
  return async function getProductDetails(productUrl: string): Promise<
    | {
        error: { code: string; message: string; meta: Record<string, unknown> };
        ok: false;
      }
    | { data: Product; ok: true }
  > {
    const fullUrl = new URL(productUrl, baseUrl).toString();
    await page.goto(fullUrl);
    (await page
      .getByRole('button', {
        name: 'Accept',
      })
      .isVisible()) &&
      (await page.getByRole('button', { name: 'Accept' }).click());

    const countryOfOrigin = await lookupCountryOfOrigin(page, logger);
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
      return {
        error: {
          code: 'ERR_ELEMENT_NOT_FOUND',
          message: 'Product Id not found',
          meta: { ogMeta: productOpenGraphMeta, url: fullUrl },
        },
        ok: false,
      };
    }
    const priceInfo: {
      price?: string | null;
      priceCurrency?: string | null;
    } = Object.fromEntries(
      (
        await page
          .locator('meta[itemprop]')
          .evaluateAll(elements =>
            elements.map(ele => [
              ele.getAttribute('itemprop'),
              ele.getAttribute('content'),
            ]),
          )
      ).filter((entity): entity is [string, string] =>
        ['price', 'priceCurrency'].includes(String(entity[0])),
      ),
    );
    if (!priceInfo.price || !priceInfo.priceCurrency) {
      return {
        error: {
          code: 'ERR_ELEMENT_NOT_FOUND',
          message: 'Price not found',
          meta: { priceInfo, url: fullUrl },
        },
        ok: false,
      };
    }

    const pricePerItem = (await page.locator('.bop-price__per').isVisible())
      ? await page.locator('.bop-price__per').textContent()
      : null;

    const price = new Intl.NumberFormat('en-GB', {
      currency: priceInfo.priceCurrency,
      style: 'currency',
    }).format(Number(priceInfo.price));

    return {
      data: {
        countryOfOrigin,
        id: productId,
        image: new URL(productOpenGraphMeta['og:image'], baseUrl).toString(),
        price,
        pricePerItem,
        title: productOpenGraphMeta['og:title'],
        type: productOpenGraphMeta['og:type'],
        url: new URL(productOpenGraphMeta['og:url'], baseUrl).toString(),
      },
      ok: true,
    };
  };
}
