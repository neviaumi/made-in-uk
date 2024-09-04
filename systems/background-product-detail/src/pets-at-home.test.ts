import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
} from '@/browser.ts';
import { loadFixtures } from '@/fixtures/loader.ts';
import { baseUrl, createProductDetailsFetcher } from '@/pets-at-home.ts';

describe('Pets at home', () => {
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
      const url = '/product/7128260P';
      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures('pets-at-home/7128260P.html'),
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
          id: '7128260P',
          image:
            'https://cdn.petsathome.com/public/images/products/900_7128260.jpg',
          price: '£19.49',
          pricePerItem: '£9.75/kg',
          title:
            'Lily’s Kitchen Fisherman’s Feast Adult Cat Dry Food White Fish & Salmon | Pets',
          type: 'product',
          url: expect.any(String),
        });
    },
    {
      timeout: 60000 * 60,
    },
  );
});
