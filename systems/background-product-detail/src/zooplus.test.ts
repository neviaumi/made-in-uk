import { describe, expect, it } from 'vitest';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
} from '@/browser.ts';
import { loadFixtures } from '@/fixtures/loader.ts';
import { baseUrl, createProductDetailsFetcher } from '@/zooplus.ts';

describe('Zooplus', () => {
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
      const url = '/shop/cats/dry_cat_food/encore/1934717';
      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures('zooplus/1934717.html'),
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
          id: '1934717',
          image:
            'https://media.zooplus.com/bilder/4/400/413997_pla_encore_cat_huhn_lachs_hs_01_4.jpg',
          price: '£5.79',
          pricePerItem: '£7.24/kg',
          title: 'Encore Cat Chicken with Salmon | zooplus.co.uk',
          type: 'product',
          url: expect.any(String),
        });
    },
    {
      timeout: 60000 * 60,
    },
  );
});
