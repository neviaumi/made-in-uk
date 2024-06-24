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
  type ProductDetailsResp = Awaited<
    ReturnType<ReturnType<typeof createProductDetailsHandler>>
  >;
  it.each([
    {
      case: 'product with country of origin',
      expectFunctions: (resp: ProductDetailsResp) => {
        expect(resp.ok).toBeTruthy();
        if (!resp.ok) throw new Error('Expected response to be ok');
        expect(resp.data.price).toEqual('£23.00');
        expect(resp.data.countryOfOrigin).toEqual('United Kingdom');
      },
      fixture: '603216011.html',
      url: '/products/budweiser-bottles-603216011',
    },
    {
      case: 'product without country of origin',
      expectFunctions: (resp: ProductDetailsResp) => {
        expect(resp.ok).toBeTruthy();
        if (!resp.ok) throw new Error('Expected response to be ok');
        expect(resp.data.countryOfOrigin).toEqual('Unknown');
      },
      fixture: '623907011.html',
      url: '/products/blue-dragon-medium-egg-noodles-623907011',
    },
  ])('$case', async ({ expectFunctions, fixture, url }) => {
    const browser = await createChromiumBrowser();
    const browserContext = await browser.newContext({
      javaScriptEnabled: false,
    });
    const page = await createBrowserPage(browserContext)();
    await page.route(new URL(url, baseUrl).toString(), async route => {
      return route.fulfill({
        body: await loadFixtures(fixture),
        status: 200,
      });
    });
    const resp = await createProductDetailsHandler(page)(url);
    await closePage(page);
    await closeBrowser(browser);
    expectFunctions(resp);
  });
}, 60000);
