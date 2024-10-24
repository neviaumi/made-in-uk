import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeBrowserPage, createBrowserPage } from '@/browser.ts';
import { APP_ENV } from '@/config.ts';
import { loadFixtures } from '@/fixtures/loader.ts';
import { createLogger } from '@/logger.ts';
import { createLLMPromptHandler } from '@/mocks/handlers.ts';
import { HttpResponse } from '@/mocks/msw.ts';
import { server } from '@/mocks/node.ts';
import { baseUrl, createProductDetailsFetcher } from '@/ocado.ts';

const logger = createLogger(APP_ENV);

describe('Ocado fetcher', () => {
  type ProductDetailsResp = Awaited<
    ReturnType<ReturnType<typeof createProductDetailsFetcher>>
  >;
  beforeAll(() => {
    server.listen();
  });
  afterAll(() => {
    server.close();
  });
  it('should use llm response when country of origin is not available', async () => {
    server.use(
      createLLMPromptHandler(() =>
        HttpResponse.json({
          message: JSON.stringify({
            extractedCountry: 'United Kingdom',
            withInUK: true,
          }),
        }),
      ),
    );

    const page = await createBrowserPage()({
      pageOptions: {
        javaScriptEnabled: false,
        offline: true,
      },
    });
    await page.route(
      new URL(
        '/products/blue-dragon-medium-egg-noodles-623907011',
        baseUrl,
      ).toString(),
      async route => {
        return route.fulfill({
          body: await loadFixtures('623907011.html'),
          status: 200,
        });
      },
    );
    const resp = await createProductDetailsFetcher(page, {
      logger,
      requestId: 'unused',
    })('/products/blue-dragon-medium-egg-noodles-623907011');
    await closeBrowserPage(page);
    expect(resp.ok).toBeTruthy();
    if (!resp.ok) throw new Error('Expected response to be ok');
    expect(resp.data.pricePerItem).toEqual('70p per 100g');
    expect(resp.data.price).toEqual('£1.75');
    expect(resp.data.countryOfOrigin).toEqual('United Kingdom');
  });
  it.each([
    {
      case: 'product with country of origin',
      expectFunctions: (resp: ProductDetailsResp) => {
        expect(resp.ok).toBeTruthy();
        if (!resp.ok) throw new Error('Expected response to be ok');
        expect(resp.data.price).toEqual('£23.00');
        expect(resp.data.pricePerItem).toEqual('29p per 100ml');
        expect(resp.data.countryOfOrigin).toEqual('United Kingdom');
      },
      fixture: '603216011.html',
      url: '/products/budweiser-bottles-603216011',
    },
    {
      case: 'product with more than £1 per item',
      expectFunctions: (resp: ProductDetailsResp) => {
        expect(resp.ok).toBeTruthy();
        if (!resp.ok) throw new Error('Expected response to be ok');
        expect(resp.data.pricePerItem).toEqual('£18.75 per kg');
        expect(resp.data.price).toEqual('£7.50');
        expect(resp.data.countryOfOrigin).toEqual('UK');
      },
      fixture: '270729011.html',
      url: '/products/daylesford-organic-outdoor-reared-pork-sausages-270729011',
    },
    {
      case: 'product with out price per item',
      expectFunctions: (resp: ProductDetailsResp) => {
        expect(resp.ok).toBeTruthy();
        if (!resp.ok) throw new Error('Expected response to be ok');
        expect(resp.data.pricePerItem).toBeNull();
        expect(resp.data.price).toEqual('£2.80');
        expect(resp.data.countryOfOrigin).toEqual('Unknown');
      },
      fixture: '567408011.html',
      url: '/products/m-s-maxim-straight-sided-mug-white-567408011',
    },
  ])('$case', async ({ expectFunctions, fixture, url }) => {
    const page = await createBrowserPage()({
      pageOptions: {
        javaScriptEnabled: false,
        offline: true,
      },
    });
    await page.route(new URL(url, baseUrl).toString(), async route => {
      return route.fulfill({
        body: await loadFixtures(fixture),
        status: 200,
      });
    });
    const resp = await createProductDetailsFetcher(page, {
      logger,
      requestId: 'unused',
    })(url);
    await closeBrowserPage(page);
    expectFunctions(resp);
  });
}, 60000);
