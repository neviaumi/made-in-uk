import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  baseUrl,
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductsSearchHandler,
} from '@/browser.ts';
import { loadFixtures } from '@/fixtures/loader.ts';

describe(
  'background-product-search',
  () => {
    it(
      'what will happen when no product found',
      async () => {
        const browser = await createChromiumBrowser({
          headless: true,
        });
        const browserContext = await browser.newContext({
          javaScriptEnabled: false,
          offline: true,
        });
        const page = await createBrowserPage(browserContext)();
        await page.route(
          new URL('/search?entry=jkfjafjk&display=1024', baseUrl).toString(),
          async route => {
            return route.fulfill({
              body: await loadFixtures('search?entry=jkfjafjk.html'),
              status: 200,
            });
          },
        );
        const respStream = Readable.from(
          createProductsSearchHandler(page)('jkfjafjk'),
        );
        respStream.on('end', async () => {
          await closePage(page);
          await closeBrowser(browser);
        });
        const numberOfRecords = await respStream.reduce(acc => {
          return acc + 1;
        }, 0);

        expect(numberOfRecords).toEqual(0);
      },
      60000 * 60,
    );
    it('should load all product in response', async () => {
      const browser = await createChromiumBrowser({
        headless: true,
      });
      const browserContext = await browser.newContext({
        javaScriptEnabled: false,
        offline: true,
      });
      const page = await createBrowserPage(browserContext)();
      await page.route(
        new URL('/search?entry=beer&display=1024', baseUrl).toString(),
        async route => {
          return route.fulfill({
            body: await loadFixtures('search?entry=beer.html'),
            status: 200,
          });
        },
      );
      const respStream = Readable.from(
        createProductsSearchHandler(page)('beer'),
      );
      respStream.on('end', async () => {
        await closePage(page);
        await closeBrowser(browser);
      });
      const numberOfRecords = await respStream.reduce(acc => {
        return acc + 1;
      }, 0);

      expect(numberOfRecords).toEqual(92);
    });
  },
  60000 * 60,
);
