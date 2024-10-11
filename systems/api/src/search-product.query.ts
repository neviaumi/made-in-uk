import { Readable } from 'node:stream';

import { Repeater } from 'graphql-yoga';
import pLimit from 'p-limit';

import {
  createCloudTaskClient,
  createProductSearchScheduler,
} from '@/cloud-task.ts';
import {
  connectToReplyStreamOnDatabase,
  createDatabaseConnection,
  getRequestStream,
  getRequestStreamProduct,
  listUserRequest,
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
  const requestId = context.requestId;
  const userId = context.userId;
  const search = parent.argument.input.keyword;
  logger.info(`Started stream product search that match ${search} ...`, {
    argument: parent.argument,
  });
  const database = createDatabaseConnection();
  const cloudTask = createCloudTaskClient();
  const replyStream = connectToReplyStreamOnDatabase(database, requestId, {
    logger,
  });
  await replyStream.init({
    input: parent.argument.input,
    operationName: context.operationName,
    userId,
  });
  await createProductSearchScheduler(cloudTask)({
    requestId: requestId,
    search: {
      keyword: search,
    },
  });
  const productSearchResult = await replyStream.waitForProductSearchResult();
  if (productSearchResult.type === 'SEARCH_PRODUCT_ERROR') {
    logger.error('search product error', { error: productSearchResult.error });
    return;
  }
  const totalExpectedDocs = productSearchResult.data.total;

  return new Repeater(async (push, stop) => {
    let documentReceived = 0;
    const productStream = replyStream.listenToReplyStreamData();
    try {
      await Readable.from(productStream).forEach(item => {
        if (!item.type) return;
        if (item.type === 'FETCH_PRODUCT_DETAIL') {
          push(item);
        }
        documentReceived += 1;
        if (totalExpectedDocs !== 0 && documentReceived >= totalExpectedDocs) {
          logger.info('Completed to stream product search result', {
            documentReceived,
            search,
            totalExpectedDocs,
          });
          productStream.end();
        }
      });
      stop();
    } catch (e) {
      logger.error('Failed to stream product search result', {
        error: e,
        search,
      });
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

export const productSearchHistoriesQuery: ResolverFunction = async (
  _,
  __,
  context,
) => {
  const userId = context.userId;
  const database = createDatabaseConnection();
  const requests = await listUserRequest(database, userId, 'searchProducts');
  const limit = pLimit(16);
  return {
    requestId: context.requestId,
    searchHistories: await Promise.all(
      requests.map(requestId =>
        limit(async () =>
          Object.assign(await getRequestStream(database, requestId), {
            id: requestId,
          }),
        ),
      ),
    ),
  };
};

export const productSearchHistoryQuery: ResolverFunction<{
  input: { requestId: string };
}> = async (_, args, context) => {
  const { requestId } = args.input;
  return {
    requestId: context.requestId,
    searchHistory: {
      id: requestId,
    },
  };
};

export const productSearchHistoryMetaQuery: ResolverFunction<
  never,
  GraphqlContext,
  { id: string }
> = async parent => {
  const { id: requestId } = parent;
  const database = createDatabaseConnection();
  return getRequestStream(database, requestId);
};

export const productSearchHistoryItemQuery: ResolverFunction<
  never,
  GraphqlContext,
  { id: string }
> = parent => {
  const requestId = parent.id;
  const database = createDatabaseConnection();
  return getRequestStreamProduct(database, requestId);
};
