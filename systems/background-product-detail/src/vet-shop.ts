import playwright from 'playwright';

import { extractTotalWeight } from '@/llm.ts';
import { type Logger } from '@/logger.ts';
import { type Product, PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.vetshop.co.uk/';

async function extractPricePerItem(
  page: playwright.Page,
  { price, productName }: { price: number; productName: string },
  option: { logger: Logger; requestId: string },
) {
  if (isNaN(price)) {
    return null;
  }
  const { data } = await extractTotalWeight(
    { description: productName },
    option,
  );
  const totalWeight = await (async () => {
    if (data.totalWeight) {
      return data.totalWeight;
    }
    // VetShop total weight can be wrong, used as a fell back
    const weightContainer = page.locator('.item-details-weight-value');
    if (!(await weightContainer.isVisible())) {
      return null;
    }
    const weight = await weightContainer
      .textContent()
      .then(text => Number(text!.trim().slice(0, -2)));
    if (isNaN(weight)) {
      return null;
    }
    return null;
  })();
  if (!totalWeight) {
    return null;
  }

  const pricePerItem = `${Intl.NumberFormat('en-GB', {
    currency: 'GBP',
    style: 'currency',
  }).format(price / totalWeight)}/${data.weightUnit}`;
  return pricePerItem;
}

export function createProductDetailsFetcher(
  page: playwright.Page,
  options: { logger: Logger; requestId: string },
) {
  return async function fetchProductDetails(productUrl: string): Promise<
    | {
        error: { code: string; message: string; meta: Record<string, unknown> };
        ok: false;
      }
    | { data: Product; ok: true }
  > {
    const logger = options.logger;
    const fullUrl = new URL(productUrl, baseUrl).toString();
    await page.goto(fullUrl);
    logger.info('Navigated to product page');

    (await page.getByRole('button', { name: 'I Agree' }).isVisible()) &&
      (await page.getByRole('button', { name: 'I Agree' }).click());
    const productTitle = await page
      .locator('meta[name="og:title"]')
      .getAttribute('content');
    const image = await page
      .locator('meta[name="og:image"]')
      .getAttribute('content')
      .then(url => decodeURI(url!));
    const url = await page
      .locator('meta[name="og:url"]')
      .getAttribute('content');
    const id = await page
      .locator('[itemprop="sku"]')
      .textContent()
      .then(text => text?.trim());

    const price = await page
      .locator('.item-views-blb-price-option', {
        has: page.getByText('Ship once'),
      })
      .locator('.item-views-blb-price-option-price')
      .first()
      .textContent();
    logger.info('Process of product page finished');

    return {
      data: {
        countryOfOrigin: 'Unknown',
        id: id!,
        image: image!,
        price: price!,
        pricePerItem: await extractPricePerItem(
          page,
          {
            price: Number(price!.slice(1)),
            productName: productTitle!,
          },
          options,
        ),
        source: PRODUCT_SOURCE.VET_SHOP,
        title: productTitle!,
        type: 'product',
        url: url!,
      },
      ok: true,
    };
  };
}
