import { Readable } from 'node:stream';

import { Repeater } from 'graphql-yoga';

import { createDatabaseConnection } from '@/database.ts';
import type { ResolverFunction } from '@/types/utilities.d.ts';

import {
  closeBrowser,
  closePage,
  createBrowserPage,
  createChromiumBrowser,
  createProductDetailsHandler,
  createProductsSearchHandler,
} from './browser.ts';
import { createProductSaver } from './product.persistent.ts';

type SearchProductQueryArgument = {
  input: { keyword: string };
};

export const searchProductQuery: ResolverFunction<
  SearchProductQueryArgument
> = async (_, argument, context) => {
  const logger = context.logger;
  logger.info(`Searching products that match ${argument.input.keyword} ...`, {
    argument,
  });
  const databse = createDatabaseConnection();
  const saveProduct = createProductSaver(databse, {
    logger: logger,
  });
  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();
  const productUrls = await createProductsSearchHandler(page)(
    argument.input.keyword,
  );
  const fetchProductDetails = createProductDetailsHandler(page);
  return new Repeater(async (push, stop) => {
    stop.finally(async () => {
      await closePage(page);
      await closeBrowser(browser);
    });
    const productDetailsGenerator = Readable.from(
      fetchProductDetails(productUrls),
    );
    for await (const productDetails of productDetailsGenerator) {
      try {
        await saveProduct(productDetails);
        await push(productDetails);
      } catch (e) {
        logger.error('streaming product details error', e);
        break;
      }
    }
    stop();
  });
};
