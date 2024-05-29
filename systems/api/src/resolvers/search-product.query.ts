import { Readable } from 'node:stream';

import { Repeater } from 'graphql-yoga';

import { createDatabaseConnection } from '@/database.ts';
import { createPubSubClient, getProductSearchTopic } from '@/pubsub.ts';
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
  const search = argument.input.keyword;
  logger.info(`Searching products that match ${search} ...`, {
    argument,
  });
  const database = createDatabaseConnection();
  const pubsub = createPubSubClient();
  logger.info(`Searching products that match ${search} ...`, {
    argument,
  });
  await getProductSearchTopic(pubsub).publishMessage({
    attributes: {
      requestId: context.requestId,
    },
    data: Buffer.from(
      JSON.stringify({
        search: {
          keyword: search,
        },
      }),
    ),
    messageId: context.requestId,
  });
  const saveProduct = createProductSaver(database, {
    logger: logger,
  });
  const browser = await createChromiumBrowser();
  const page = await createBrowserPage(browser)();
  const productUrls = await createProductsSearchHandler(page)(search);
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
        stop(e);
        break;
      }
    }
    stop();
  });
};
