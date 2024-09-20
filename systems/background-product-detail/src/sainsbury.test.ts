import { describe, expect, it, vi } from 'vitest';

import {
  closeBrowser,
  closePage,
  createAntiDetectionChromiumBrowser,
  createBrowserPage,
} from '@/browser.ts';
import { APP_ENV } from '@/config.ts';
import { loadFixtures } from '@/fixtures/loader.ts';
import { createLogger } from '@/logger.ts';
import { baseUrl, createProductDetailsFetcher } from '@/sainsbury.ts';

const logger = createLogger(APP_ENV);

describe('Sainsbury', () => {
  it(
    'Testing',
    async () => {
      const browser = await createAntiDetectionChromiumBrowser({
        headless: true,
      });
      const page = await createBrowserPage(browser)({
        javaScriptEnabled: false,
        offline: true,
      });
      const url =
        '/shop/gb/groceries/product/details/peroni-nastro-azzuro-12x330ml';

      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures(
            'sainsbury/peroni-nastro-azzuro-12x330ml.html',
          ),
          status: 200,
        });
      });
      const spy = vi.spyOn(page, 'waitForResponse');
      spy.mockResolvedValue(
        await (async () => {
          const resp = new Response(
            await loadFixtures('sainsbury/peroni-nastro-azzuro-12x330ml.json'),
            {
              status: 200,
            },
          );
          const url = new URL(
            '/groceries-api/gol-services/product/v1/product',
            baseUrl,
          );
          url.searchParams.set('filter[product_seo_url]', url.pathname);
          Object.defineProperty(resp, 'url', {
            value: () => url.toString(),
          });
          Object.defineProperty(resp, 'status', {
            value: () => 200,
          });
          Object.defineProperty(resp, 'request', {
            value: () => {
              return {
                method() {
                  return 'GET';
                },
              };
            },
          });
          return resp as any;
        })(),
      );

      const data = await createProductDetailsFetcher(page, {
        logger: logger,
        requestId: 'requestId',
      })(url);
      expect(data.ok).toBeTruthy();
      if (data.ok) {
        expect(data.data).toEqual({
          countryOfOrigin: 'United Kingdom',
          id: '6546263',
          image: expect.any(String),
          price: '£15.00',
          pricePerItem: '3.79 per ltr',
          source: 'SAINSBURY',
          title:
            'Peroni Nastro Azzurro Beer Lager Bottles 12x330ml | Sainsbury',
          type: 'product',
          url: expect.any(String),
        });
      }

      await closePage(page);
      await closeBrowser(browser);
    },
    {
      timeout: 60000 * 60,
    },
  );
});
