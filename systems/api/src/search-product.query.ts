import { Repeater } from 'graphql-yoga';

import {
  closeReplyStream,
  createDatabaseConnection,
  createListenerToReplyStreamData,
} from '@/database.ts';
import { createPubSubClient, getProductSearchTopic } from '@/pubsub.ts';
import type { ResolverFunction } from '@/types.ts';

type SearchProductQueryArgument = {
  input: { keyword: string };
};

export const searchProductQuery: ResolverFunction<
  SearchProductQueryArgument
> = async (_, argument, context) => {
  const logger = context.logger;
  const requestId = context.requestId;
  const search = argument.input.keyword;
  logger.info(`Searching products that match ${search} ...`, {
    argument,
  });
  const database = createDatabaseConnection();
  const pubsub = createPubSubClient();
  await getProductSearchTopic(pubsub).publishMessage({
    attributes: {
      requestId: requestId,
    },
    data: Buffer.from(
      JSON.stringify({
        search: {
          keyword: search,
        },
      }),
    ),
  });
  const connectMatchProductStream = createListenerToReplyStreamData(database, {
    logger: logger,
  });
  return new Repeater(async (push, stop) => {
    stop.then(() =>
      closeReplyStream(database, {
        logger: logger,
      })(requestId),
    );
    try {
      await connectMatchProductStream(requestId).forEach(productDetail => {
        if (productDetail.type === 'FETCH_PRODUCT_DETAIL_FAILURE') {
          return;
        }
        push(productDetail);
      });
      stop();
    } catch (e) {
      logger.error('streaming product details error', { error: e });
      stop(e);
    }
  });
};
