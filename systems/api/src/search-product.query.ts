import { Readable } from 'node:stream';

import { Repeater } from 'graphql-yoga';

import {
  createCloudTaskClient,
  createProductSearchScheduler,
} from '@/cloud-task.ts';
import {
  closeReplyStream,
  connectToReplyStreamOnDatabase,
  createDatabaseConnection,
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
  const replyStream = connectToReplyStreamOnDatabase(database, requestId);
  await replyStream.init();
  await createProductSearchScheduler(cloudTask)({
    requestId: requestId,
    search: {
      keyword: search,
    },
  });

  return new Repeater(async (push, stop) => {
    stop.then(() =>
      closeReplyStream(database, {
        logger: logger,
      })(requestId),
    );
    let totalExpectedDocs = 0;
    let documentReceived = 0;
    const productStream = replyStream.listenToReplyStreamData();
    try {
      await Readable.from(productStream).forEach(item => {
        logger.info('Receive item from stream', {
          item,
        });
        if (!item.type) return;
        if (item.type === 'SEARCH_PRODUCT') {
          totalExpectedDocs = item.data.total;
          return;
        }
        if (item.type === 'SEARCH_PRODUCT_ERROR') {
          logger.error('search product error', { error: item.error });
          productStream.end();
          return;
        }
        if (item.type === 'FETCH_PRODUCT_DETAIL_FAILURE') {
          return;
        }
        push(item);
        documentReceived += 1;
        if (totalExpectedDocs !== 0 && documentReceived >= totalExpectedDocs) {
          logger.info('search product finish', {
            documentReceived,
            totalExpectedDocs,
          });
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
