import { Readable } from 'node:stream';

import {
  createCloudTaskClient,
  createProductDetailScheduler,
  TASK_TYPE,
} from '@/cloud-task.ts';
import {
  closeReplyStream,
  connectToProductDatabase,
  createDatabaseConnection,
  createListenerToReplyStreamData,
  handleNoHeaderStream,
} from '@/database.ts';
import type { GraphqlContext, ResolverFunction } from '@/types.ts';

type DealMonitorQueryArgument = {
  input: { monitorId: string };
};

const monitors: {
  [id: string]: {
    description: string;
    id: string;
    items: Array<{
      id: string;
      source: 'LILYS_KITCHEN' | 'PETS_AT_HOME' | 'ZOOPLUS';
      url: string;
    }>;
    name: string;
  };
} = {
  '1': {
    description: 'Monitor on cat dry food',
    id: '1',
    items: [
      {
        id: 'ZCDDC4KG',
        source: 'LILYS_KITCHEN',
        url: '/for-cats/dry-food/chicken-with-veggies-dry-food-2kg-ZCDDC4KG.html',
      },
      {
        id: '7139492P',
        source: 'PETS_AT_HOME',
        url: '/product/7139492P',
      },
      {
        id: '7142461P',
        source: 'PETS_AT_HOME',
        url: '/product/7142461P',
      },
      {
        id: '1934717',
        source: 'ZOOPLUS',
        url: '/shop/cats/dry_cat_food/encore/1934717',
      },
      {
        id: 'ZCDFF2KG',
        source: 'LILYS_KITCHEN',
        url: '/for-cats/dry-food/white-fish-and-salmon-dry-food-2kg-ZCDFF2KG.html',
      },
      {
        id: '7128260P',
        source: 'PETS_AT_HOME',
        url: '/product/7128260P',
      },
    ],
    name: 'Cat Dry Food',
  },
};

export const dealMonitorItemDefer: ResolverFunction<
  never,
  GraphqlContext,
  { monitor: { id: string; numberOfItems: number }; requestId: string }
> = async (parent, _, context) => {
  const logger = context.logger;
  logger.info('dealMonitorItemDefer');
  const requestId = parent.requestId;
  const monitor = monitors[parent.monitor.id];
  const database = createDatabaseConnection();
  const cloudTask = createCloudTaskClient();
  const productDetailScheduler = createProductDetailScheduler(cloudTask);
  const productDatabase = connectToProductDatabase(database);
  const items: Array<unknown> = [];
  for (const item of monitor.items) {
    const cachedRecord = await productDatabase.getProduct(item.source, item.id);
    logger.info('cachedRecord', cachedRecord);
    if (!cachedRecord.ok) {
      await productDetailScheduler({
        product: {
          productId: item.id,
          productUrl: item.url,
          source: item.source,
        },
        requestId: requestId,
        type: TASK_TYPE.FETCH_PRODUCT_DETAIL,
      });
    } else {
      items.push(cachedRecord.data);
    }
  }

  if (items.length === parent.monitor.numberOfItems) {
    return items;
  }
  const replyStream = createListenerToReplyStreamData(
    database,
    handleNoHeaderStream,
    {
      logger: logger,
    },
  )(requestId);
  await Readable.from(replyStream).forEach(item => {
    items.push(item.data);
    if (items.length === parent.monitor.numberOfItems) {
      replyStream.end();
    }
  });
  await closeReplyStream(database, { logger: logger })(requestId);
  return items;
};

export const listDealMonitorsQuery: ResolverFunction<never> = (
  _,
  __,
  context,
) => {
  const requestId = context.requestId;

  return {
    monitors: Object.values(monitors).map(monitor => ({
      description: monitor.description,
      id: monitor.id,
      name: monitor.name,
      numberOfItems: monitor.items.length,
    })),
    requestId,
  };
};

export const getDealMonitorQuery: ResolverFunction<DealMonitorQueryArgument> = (
  _,
  args,
  context,
) => {
  const requestId = context.requestId;
  const monitor = monitors[args.input.monitorId];
  if (!monitor) {
    throw new Error('Monitor not found');
  }
  const resp = {
    argument: args,
    monitor: {
      description: monitor.description,
      id: monitor.id,
      name: monitor.name,
      numberOfItems: monitor.items.length,
    },
    requestId: requestId,
  };
  context.logger.info('getDealMonitorQuery', {
    resp,
  });
  return resp;
};
