import { describe, expect, it } from 'vitest';

import {
  baseUrl,
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductDetailsHandler,
} from '@/browser.ts';
import { loadFixtures } from '@/fixtures/loader.ts';

describe('background-product-detail', () => {
  it('should include pricing info in response', async () => {
    const browser = await createChromiumBrowser();
    const page = await createBrowserPage(browser)();
    await page.route(
      new URL('/products/budweiser-bottles-603216011', baseUrl).toString(),
      async route => {
        return route.fulfill({
          body: await loadFixtures('603216011.html'),
          status: 200,
        });
      },
    );
    const resp = await createProductDetailsHandler(page)(
      '/products/budweiser-bottles-603216011',
    );
    await closePage(page);
    await closeBrowser(browser);
    expect(resp.ok).toBeTruthy();
    if (resp.ok) {
      expect(resp.data.price).toEqual('£23.00');
    }
  });
}, 60000);
