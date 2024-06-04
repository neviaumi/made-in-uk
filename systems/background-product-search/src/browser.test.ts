import { describe, expect, it } from 'vitest';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductsSearchHandler,
} from './browser.ts';

describe.skip('Test browser.ts', () => {
  it(
    'should return all items',
    async () => {
      const browser = await createChromiumBrowser({});
      const page = await createBrowserPage(browser)();
      const searchResult = await createProductsSearchHandler(page)('beer');
      await closePage(page);
      await closeBrowser(browser);
      expect(searchResult.ok).toBeTruthy();
      if (searchResult.ok) {
        expect(searchResult.data).toHaveLength(163);
      }
    },
    60000 * 60,
  );
});
