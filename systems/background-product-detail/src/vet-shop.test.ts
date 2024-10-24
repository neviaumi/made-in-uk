import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeBrowserPage, createBrowserPage } from '@/browser.ts';
import { APP_ENV } from '@/config.ts';
import { loadFixtures } from '@/fixtures/loader.ts';
import { createLogger } from '@/logger.ts';
import { createLLMPromptHandler } from '@/mocks/handlers.ts';
import { HttpResponse } from '@/mocks/msw.ts';
import { server } from '@/mocks/node.ts';
import { baseUrl, createProductDetailsFetcher } from '@/vet-shop.ts';

describe('Vet Shop', () => {
  beforeAll(() => {
    server.listen();
  });
  afterAll(() => {
    server.close();
  });
  it(
    'Cat Wet food',
    async () => {
      server.use(
        createLLMPromptHandler(() =>
          HttpResponse.json({
            message: JSON.stringify({
              totalWeight: 0.56,
              weightUnit: 'kg',
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
      const url = '/Lilys-Kitchen-Shredded-Fillets-Variety';
      await page.route(new URL(url, baseUrl).toString(), async route => {
        return route.fulfill({
          body: await loadFixtures(
            'vet-shop/Lilys-Kitchen-Shredded-Fillets-Variety.html',
          ),
          status: 200,
        });
      });
      const data = await createProductDetailsFetcher(page, {
        logger: createLogger(APP_ENV),
        requestId: 'unused',
      })(url);
      await page.pause();
      await closeBrowserPage(page);
      expect(data.ok).toBeTruthy();
      data.ok &&
        expect(data.data).toEqual({
          countryOfOrigin: 'Unknown',
          id: '731873',
          image:
            'https://www.vetshop.co.uk/SCA%20Product%20Images/Lilys-Kitchen-Shredded-Fillets-Variety_vetshop-1.png?resizeid=8&resizeh=300&resizew=300',
          price: '£7.55',
          pricePerItem: '£13.48/kg',
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
