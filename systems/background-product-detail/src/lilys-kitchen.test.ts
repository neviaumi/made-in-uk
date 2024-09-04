import { describe, expect, it } from 'vitest';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
} from '@/browser.ts';
import { loadFixtures } from '@/fixtures/loader.ts';
import { baseUrl, createProductDetailsFetcher } from '@/lilys-kitchen.ts';

describe('Lilys Kitchen', () => {
  it(
    'Cat Dry food',
    async () => {
      const browser = await createChromiumBrowser({
        headless: true,
      });
      const page = await createBrowserPage(browser)({
        javaScriptEnabled: false,
        offline: true,
      });
      const url =
        '/for-cats/dry-food/chicken-with-veggies-dry-food-4kg-ZCDDC4KG.html';
      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures('lilys-kitchen/ZCDDC4KG.html'),
          status: 200,
        });
      });
      const data = await createProductDetailsFetcher(page)(url);
      await closePage(page);
      await closeBrowser(browser);
      expect(data.ok).toBeTruthy();
      data.ok &&
        expect(data.data).toEqual({
          countryOfOrigin: 'Unknown',
          id: 'ZCDDC4KG',
          image:
            'https://www.lilyskitchen.co.uk/dw/image/v2/BCBF_PRD/on/demandware.static/-/Sites-lilsrp-master-catalog/default/dwd7c74b6c/images/hi-res/BCDDC.png?sw=600&sh=600&sm=fit',
          price: '£53.00',
          pricePerItem: '£13.25/kg',
          title: 'Chicken with Veggies Dry Food (4kg)',
          type: 'product',
          url: expect.any(String),
        });
    },
    {
      timeout: 60000 * 60,
    },
  );
});
