import { describe, expect, it } from 'vitest';

import { closeBrowserPage, createBrowserPage } from '@/browser.ts';
import { loadFixtures } from '@/fixtures/loader.ts';
import { baseUrl, createProductDetailsFetcher } from '@/zooplus.ts';

describe('Zooplus', () => {
  it(
    'Cat Dry food',
    async () => {
      const page = await createBrowserPage()({
        pageOptions: {
          javaScriptEnabled: false,
          offline: true,
        },
      });
      const url = '/shop/cats/dry_cat_food/encore/1934717';
      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures('zooplus/1934717.html'),
          status: 200,
        });
      });
      const data = await createProductDetailsFetcher(page)(url);
      await closeBrowserPage(page);
      expect(data.ok).toBeTruthy();
      data.ok &&
        expect(data.data).toEqual({
          countryOfOrigin: 'Unknown',
          id: '1934717',
          image:
            'https://media.zooplus.com/bilder/4/400/413997_pla_encore_cat_huhn_lachs_hs_01_4.jpg',
          price: '£5.79',
          pricePerItem: '£7.24/kg',
          source: 'ZOOPLUS',
          title: 'Encore Cat Chicken with Salmon | zooplus.co.uk',
          type: 'product',
          url: expect.any(String),
        });
    },
    {
      timeout: 60000 * 60,
    },
  );
  it(
    'Product running on reduced price',
    async () => {
      const page = await createBrowserPage()({
        pageOptions: {
          javaScriptEnabled: false,
          offline: true,
        },
      });
      const url = '/shop/cats/dry_cat_food/encore/1946560';
      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures('zooplus/1946560.html'),
          status: 200,
        });
      });
      const data = await createProductDetailsFetcher(page)(url);
      await closeBrowserPage(page);
      expect(data.ok).toBeTruthy();
      data.ok &&
        expect(data.data).toEqual({
          countryOfOrigin: 'Unknown',
          id: '1946560',
          image:
            'https://media.zooplus.com/bilder/4/400/413498_encore_dose_bruhe_huhn_hs_01_3_4.jpg',
          price: '€28.49',
          pricePerItem: '€16.96/kg',
          source: 'ZOOPLUS',
          title:
            'Encore Cans in Broth Saver Pack 24 x 70g | Top deals at zooplus!',
          type: 'product',
          url: expect.any(String),
        });
    },
    {
      timeout: 60000 * 60,
    },
  );
});
