import { Readable } from 'node:stream';

import { Repeater } from 'graphql-yoga';

import {
  createCloudTaskClient,
  createProductSearchScheduler,
} from '@/cloud-task.ts';
import {
  closeReplyStream,
  createDatabaseConnection,
  createListenerToReplyStreamData,
} from '@/database.ts';
import type { GraphqlContext, ResolverFunction } from '@/types.ts';

type SearchProductQueryArgument = {
  input: { keyword: string };
};

export const searchProductStream: ResolverFunction<
  never,
  GraphqlContext,
  { argument: SearchProductQueryArgument; requestId: string }
> = async (parent, _, context) => {
  const logger = context.logger;
  const requestId = parent.requestId;
  const search = parent.argument.input.keyword;
  logger.info(`Searching products that match ${search} ...`, {
    argument: parent.argument,
  });
  const database = createDatabaseConnection();
  const cloudTask = createCloudTaskClient();
  await createProductSearchScheduler(cloudTask)({
    requestId: requestId,
    search: {
      keyword: search,
    },
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
    let totalExpectedDocs = 0;
    let documentReceived = 0;
    const productStream = connectMatchProductStream(requestId);
    try {
      await Readable.from(productStream).forEach(item => {
        if (item.type === 'SEARCH_PRODUCT') {
          totalExpectedDocs = item.data.total;
          return;
        }
        if (item.type === 'SEARCH_PRODUCT_ERROR') {
          productStream.end();
          return;
        }
        if (item.type === 'FETCH_PRODUCT_DETAIL_FAILURE') {
          return;
        }
        push(item);
        documentReceived += 1;
        if (totalExpectedDocs !== 0 && documentReceived >= totalExpectedDocs) {
          productStream.end();
        }
      });
      stop();
    } catch (e) {
      logger.error('streaming product details error', { error: e });
      stop(e);
    }
  });
};

export const searchProductQuery: ResolverFunction<
  SearchProductQueryArgument
> = async (_, args, context) => {
  const requestId = context.requestId;
  return {
    argument: args,
    requestId: requestId,
  };
};
