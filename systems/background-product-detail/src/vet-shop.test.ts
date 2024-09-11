import { describe, expect, it } from 'vitest';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
} from '@/browser.ts';
import { loadFixtures } from '@/fixtures/loader.ts';
import { baseUrl, createProductDetailsFetcher } from '@/vet-shop.ts';

describe('Vet Shop', () => {
  it(
    'Cat Wet food',
    async () => {
      const browser = await createChromiumBrowser({
        headless: true,
      });
      const page = await createBrowserPage(browser)({
        javaScriptEnabled: false,
        offline: true,
      });
      const url = '/Lilys-Kitchen-Shredded-Fillets-Variety';
      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures(
            'vet-shop/Lilys-Kitchen-Shredded-Fillets-Variety.html',
          ),
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
          id: '731873',
          image:
            'https://www.vetshop.co.uk/SCA%20Product%20Images/Lilys-Kitchen-Shredded-Fillets-Variety_vetshop-1.png?resizeid=8&resizeh=300&resizew=300',
          price: '£8.39',
          pricePerItem: '£29.96/kg',
          source: 'VET_SHOP',
          title:
            "Lily's Kitchen Shredded Fillets Variety Pack Wet Cat Food Tins - 8 x 70g   By Lilys Kitchen",
          type: 'product',
          url: expect.any(String),
        });
    },
    {
      timeout: 60000 * 60,
    },
  );
});
