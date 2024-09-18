import { Readable } from 'node:stream';

import {
  createCloudTaskClient,
  createProductDetailScheduler,
} from '@/cloud-task.ts';
import {
  closeReplyStream,
  connectToReplyStreamOnDatabase,
  createDatabaseConnection,
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
      source: 'LILYS_KITCHEN' | 'PETS_AT_HOME' | 'ZOOPLUS' | 'VET_SHOP';
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
  '2': {
    description: 'Monitor on cat wet food',
    id: '2',
    items: [
      {
        id: '1934688',
        source: 'ZOOPLUS',
        url: '/shop/cats/canned_cat_food_pouches/encore/cans/1934688',
      },
      {
        id: '693953',
        source: 'ZOOPLUS',
        url: '/shop/cats/canned_cat_food_pouches/encore/cans/693953',
      },
      {
        id: '1946567',
        source: 'ZOOPLUS',
        url: '/shop/cats/canned_cat_food_pouches/encore/cans/1946567',
      },
      {
        id: '693948',
        source: 'ZOOPLUS',
        url: '/shop/cats/canned_cat_food_pouches/encore/cans/693948',
      },
      {
        id: '1080139.0',
        source: 'ZOOPLUS',
        url: '/shop/cats/canned_cat_food_pouches/lilys_kitchen_wet_cat_food/lilys_kitchen_cans/1080139?activeVariant=1080139.0',
      },
      {
        id: '1080139.1',
        source: 'ZOOPLUS',
        url: '/shop/cats/canned_cat_food_pouches/lilys_kitchen_wet_cat_food/lilys_kitchen_cans/1080139?activeVariant=1080139.1',
      },
      {
        id: '7141317P',
        source: 'PETS_AT_HOME',
        url: '/product/lilys-kitchen-shredded-fillets-wet-cats-food-multipack-8-tin/7141317P',
      },
      {
        id: '7144736P',
        source: 'PETS_AT_HOME',
        url: '/product/lilys-kitchen-shredded-fillets-wet-adult-cat-food-multipack-16-tins/7144736P',
      },
      {
        id: '7142879P',
        source: 'PETS_AT_HOME',
        url: '/product/encore-wet-adult-cat-food-tuna-fillet-in-broth-16-tins/7142879P',
      },
      {
        id: 'CSFM70',
        source: 'LILYS_KITCHEN',
        url: '/for-cats/wet-food/shredded-fillets-8-x-70g-multipack-CSFM70.html',
      },
      {
        id: 'KCSFTS70',
        source: 'LILYS_KITCHEN',
        url: '/for-cats/wet-food/tuna-with-salmon-shredded-fillets-24-x-70g-KCSFTS70.html',
      },
      {
        id: 'ENC1104-1EN',
        source: 'VET_SHOP',
        url: '/Encore-Natural-Wet-Cat-Food-Tins-Fish-Selection-Broth-12-x-70g',
      },
      {
        id: '569176',
        source: 'VET_SHOP',
        url: '/Applaws-Tuna-Fillet-Wet-Cat-Food-Tins-24-x-70g',
      },
      {
        id: '42136',
        source: 'VET_SHOP',
        url: '/Catit-Cuisine-Tuna-Pt-with-Sardines-Wet-Cat-Food-12-x-95g',
      },
      {
        id: 'ENC1003-1EN',
        source: 'VET_SHOP',
        url: '/Encore-Natural-Wet-Cat-Food-Tins-Tuna-Fillet-in-Broth-16-x-70g',
      },
      {
        id: '289034',
        source: 'ZOOPLUS',
        url: '/shop/cats/canned_cat_food_pouches/applaws/applaws_wet_cat_food/289034',
      },
      {
        id: '540682',
        source: 'ZOOPLUS',
        url: '/shop/cats/canned_cat_food_pouches/applaws/applaws_wet_cat_food/540682',
      },
      {
        id: '1326515',
        source: 'ZOOPLUS',
        url: '/shop/cats/canned_cat_food_pouches/applaws/applaws_wet_cat_food/1326515',
      },
    ],
    name: 'Cat Wet Food',
  },
};

export const dealMonitorItemDefer: ResolverFunction<
  never,
  GraphqlContext,
  { monitor: { id: string; numberOfItems: number }; requestId: string }
> = async (parent, _, context) => {
  const logger = context.logger;
  const requestId = parent.requestId;
  const monitor = monitors[parent.monitor.id];
  const database = createDatabaseConnection();
  const cloudTask = createCloudTaskClient();
  const productDetailScheduler = createProductDetailScheduler(cloudTask);
  const replyStream = connectToReplyStreamOnDatabase(database, requestId);
  await replyStream.init();

  const items: Array<unknown> = [];
  for (const item of monitor.items) {
    await productDetailScheduler({
      product: {
        productId: item.id,
        productUrl: item.url,
        source: item.source,
      },
      requestId: requestId,
    });
  }
  const productStream = replyStream.listenToReplyStreamData();
  await Readable.from(productStream).forEach(item => {
    if (item.type === 'FETCH_PRODUCT_DETAIL_FAILURE') {
      logger.info('error when fetching product detail', {
        error: item.error,
        payload: item.error.meta.payload,
      });
      items.push({
        data: {
          id: item.error.meta.payload.product.productId,
        },
        type: 'FETCH_PRODUCT_DETAIL_FAILURE',
      });
    }
    items.push(item);
    if (items.length === parent.monitor.numberOfItems) {
      productStream.end();
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
