import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { closeBrowserPage, createBrowserPage } from '@/browser.ts';
import { APP_ENV } from '@/config.ts';
import { loadFixtures } from '@/fixtures/loader.ts';
import { createLogger } from '@/logger.ts';
import { baseUrl, createProductsSearchHandler } from '@/sainsbury.ts';

const logger = createLogger(APP_ENV);

describe('background-product-search', () => {
  it(
    'fetch until no more product found',
    async () => {
      const page = await createBrowserPage()({
        pageOptions: {
          javaScriptEnabled: false,
          offline: true,
        },
      });
      await page.route(
        new URL('/gol-ui/SearchResults/Beer', baseUrl).toString(),
        async route => {
          return route.fulfill({
            body: await loadFixtures('sainsbury/Beer?pageNumber=1.html'),
            status: 200,
          });
        },
      );
      await page.route(
        new URL('/gol-ui/SearchResults/Beer?pageNumber=1', baseUrl).toString(),
        async route => {
          return route.fulfill({
            body: await loadFixtures('sainsbury/Beer?pageNumber=1.html'),
            status: 200,
          });
        },
      );
      await page.route(
        new URL(
          `/groceries-api/gol-services/product/v1/product?${new URLSearchParams(
            [
              ['filter[keyword]', 'Beer'],
              ['page_number', '1'],
              ['page_size', '90'],
            ],
          ).toString()}`,
          baseUrl,
        ).toString(),
        async route => {
          return route.fulfill({
            body: await loadFixtures(
              'sainsbury/product?filter[keyword]=Beer&page_number=1.html',
            ),
            status: 200,
          });
        },
      );
      await page.route(
        new URL('/gol-ui/SearchResults/Beer?pageNumber=2', baseUrl).toString(),
        async route => {
          return route.fulfill({
            body: await loadFixtures('sainsbury/Beer?pageNumber=2.html'),
            status: 200,
          });
        },
      );
      await page.route(
        new URL(
          `/groceries-api/gol-services/product/v1/product?${new URLSearchParams(
            [
              ['filter[keyword]', 'Beer'],
              ['page_number', '2'],
              ['page_size', '90'],
            ],
          ).toString()}`,
          baseUrl,
        ).toString(),
        async route => {
          return route.fulfill({
            body: await loadFixtures(
              'sainsbury/product?filter[keyword]=Beer&page_number=2.html',
            ),
            status: 200,
          });
        },
      );
      const streams = Readable.from(
        createProductsSearchHandler(page, { logger })('Beer'),
      );
      streams.on('end', async () => {
        await closeBrowserPage(page);
      });
      const response = await streams.toArray();
      expect(new Set(response.map(item => item[0])).size).toEqual(
        response.length,
      );
    },
    {
      timeout: 60000 * 60,
    },
  );
});
