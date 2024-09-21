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
    'handle price per item less than one pound',
    async () => {
      const browser = await createAntiDetectionChromiumBrowser({
        headless: true,
      });
      const page = await createBrowserPage(browser)({
        javaScriptEnabled: false,
        offline: true,
      });
      const url = '/gol-ui/product/sainsburys-british-whole-milk-227l-4-pint-';

      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures('sainsbury/dummy.html'),
          status: 200,
        });
      });
      const spy = vi.spyOn(page, 'waitForResponse');
      spy.mockResolvedValue(
        await (async () => {
          const resp = new Response(
            await loadFixtures(
              'sainsbury/sainsburys-british-whole-milk-227l-4-pint-.json',
            ),
            {
              status: 200,
            },
          );
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
          countryOfOrigin: `Produced in United Kingdom
Packed in United Kingdom`,
          id: '181402',
          image: expect.any(String),
          price: '£1.45',
          pricePerItem: '64p per ltr',
          source: 'SAINSBURY',
          title: "Sainsbury's British Whole Milk 2.27L (4 pint) | Sainsbury",
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
  it(
    "handle product country of origin wasn't able to split",
    async () => {
      const browser = await createAntiDetectionChromiumBrowser({
        headless: true,
      });
      const page = await createBrowserPage(browser)({
        javaScriptEnabled: false,
        offline: true,
      });
      const url = '/gol-ui/product/courvoisier-cognac--vs-70cl';

      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures('sainsbury/dummy.html'),
          status: 200,
        });
      });
      const spy = vi.spyOn(page, 'waitForResponse');
      spy.mockResolvedValue(
        await (async () => {
          const resp = new Response(
            await loadFixtures('sainsbury/courvoisier-cognac--vs-70cl.json'),
            {
              status: 200,
            },
          );
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
          countryOfOrigin: 'Product of France',
          id: '2340654',
          image: expect.any(String),
          price: '£26.00',
          pricePerItem: '£37.14 per ltr',
          source: 'SAINSBURY',
          title: 'Courvoisier VS Cognac 70cl | Sainsbury',
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
  it(
    'parse product details',
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
          body: await loadFixtures('sainsbury/dummy.html'),
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
          pricePerItem: '£3.79 per ltr',
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
