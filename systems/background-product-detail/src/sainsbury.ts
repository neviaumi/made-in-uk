import type { Page } from '@/browser.ts';
import { extractCountryFromAddress } from '@/llm.ts';
import { type Logger } from '@/logger.ts';
import { type Product, PRODUCT_SOURCE } from '@/types.ts';

export const baseUrl = 'https://www.sainsburys.co.uk/';
export function createProductDetailsFetcher(
  page: Page,
  {
    logger,
    requestId,
  }: {
    logger: Logger;
    requestId: string;
  },
) {
  return async function fetchProductDetails(productUrl: string): Promise<
    | {
        error: { code: string; message: string; meta: Record<string, unknown> };
        ok: false;
      }
    | { data: Product; ok: true }
  > {
    const fullUrl = new URL(productUrl, baseUrl).toString();
    const apiRequest = page.waitForResponse(response => {
      const requestUrl = new URL(response.url());
      return (
        requestUrl.searchParams.has('filter[product_seo_url]') &&
        requestUrl
          .toString()
          .startsWith(
            new URL(
              '/groceries-api/gol-services/product/v1/product',
              baseUrl,
            ).toString(),
          ) &&
        response.status() === 200 &&
        response.request().method() === 'GET'
      );
    });

    await page.goto(fullUrl, {
      waitUntil: 'commit',
    });

    (await page
      .getByRole('button', {
        name: 'Accept all cookies',
      })
      .isVisible()) &&
      (await page.getByRole('button', { name: 'Accept all cookies' }).click());

    const resp = await apiRequest.then(resp => resp.json());
    const {
      products: [product],
    } = resp;
    const hasNectarPrice = product.nectar_price !== undefined;
    const price = hasNectarPrice
      ? product.nectar_price.retail_price
      : product.retail_price.price;
    const pricePerUnit = hasNectarPrice
      ? product.nectar_price.unit_price
      : product.unit_price?.price ?? null;
    const pricePerUnitString = ((priceNumber: number | null) => {
      if (!priceNumber) return null;
      if (priceNumber < 1) {
        return `${priceNumber * 100}p`;
      }
      return new Intl.NumberFormat('en-GB', {
        currency: 'GBP',
        style: 'currency',
      }).format(priceNumber);
    })(pricePerUnit);
    const productDetailHtml = Buffer.from(
      product.details_html,
      'base64',
    ).toString('utf-8');
    await page.setContent(productDetailHtml);
    let countryOfOrigin: string | null = null;
    if (productDetailHtml.includes('Country of Origin')) {
      countryOfOrigin = await page
        .locator('#accordion-content', {
          has: page.getByRole('heading', { name: 'Country of Origin' }),
        })
        .textContent()
        .then(text => {
          if (!text) return null;
          const countryOfOriginText = text
            .trim()
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line !== 'Country of Origin');
          const [countryOfOriginLine] = countryOfOriginText.filter(line =>
            line.includes('Country of origin'),
          );
          if (!countryOfOriginLine) return countryOfOriginText.join('\n');
          return countryOfOriginLine.split(':')[1].trim();
        });
    } else if (productDetailHtml.includes('Manufacturer')) {
      const manufacturer = await page
        .locator('#accordion-content', {
          has: page.getByRole('heading', { name: 'Manufacturer' }),
        })
        .textContent()
        .then(text => {
          if (!text) return null;
          return text
            .trim()
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line !== 'Manufacturer')
            .join('\n');
        });
      if (manufacturer) {
        countryOfOrigin = await extractCountryFromAddress(manufacturer, {
          logger,
          requestId,
        }).then(resp => resp.data.extractedCountry);
      }
    }
    return {
      data: {
        countryOfOrigin: countryOfOrigin ?? 'Unknown',
        id: product.product_uid,
        image: product.image,
        price: new Intl.NumberFormat('en-GB', {
          currency: 'GBP',
          style: 'currency',
        }).format(Number(price)),
        pricePerItem: pricePerUnitString
          ? `${pricePerUnitString} per ${product.unit_price.measure}`
          : null,
        source: PRODUCT_SOURCE.SAINSBURY,
        title: `${product.name} | Sainsbury`,
        type: 'product',
        url: product.full_url,
      },
      ok: true,
    };
  };
}
