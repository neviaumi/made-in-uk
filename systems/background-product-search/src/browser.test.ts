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

describe('background-product-search', () => {
  it('should load all product in response', async () => {
    const browser = await createChromiumBrowser();
    const browserContext = await browser.newContext({
      javaScriptEnabled: false,
    });
    const page = await createBrowserPage(browserContext)();
    await page.route(
      new URL('/search?entry=beer', baseUrl).toString(),
      async route => {
        return route.fulfill({
          body: await loadFixtures('search?entry=beer.html'),
          status: 200,
        });
      },
    );
    const resp = await createProductsSearchHandler(page)('beer');
    await closePage(page);
    await closeBrowser(browser);
    expect(resp.ok).toBeTruthy();
    if (resp.ok) {
      expect(Object.keys(resp.data).length).toBeGreaterThan(0);
    }
  });
}, 60000);
