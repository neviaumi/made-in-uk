import { Readable } from 'node:stream';

import { Repeater } from 'graphql-yoga';

import type { ResolverFunction } from '@/types/utilities.d.ts';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductDetailsHandler,
  createProductsSearchHandler,
} from './browser.ts';

type SearchProductQueryArgument = {
  input: { keyword: string };
};

export const searchProductQuery: ResolverFunction<
  SearchProductQueryArgument
> = async (_, argument, context) => {
  context.logger.info(
    `Searching products that match ${argument.input.keyword} ...`,
    {
      argument,
    },
  );
  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();
  const productUrls = await createProductsSearchHandler(page)(
    argument.input.keyword,
  );
  const fetchProductDetails = createProductDetailsHandler(page);
  return new Repeater(async (push, stop) => {
    stop.then(async () => {
      await closePage(page);
      await closeBrowser(browser);
    });
    const productDetailsGenerator = fetchProductDetails(productUrls);
    const productDetailsStream = Readable.from(productDetailsGenerator);
    for await (const productDetails of productDetailsStream) {
      await push(productDetails);
    }
    stop();
  });
};
