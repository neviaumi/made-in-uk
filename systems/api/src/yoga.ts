import { randomUUID } from 'node:crypto';

import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { createSchema, createYoga, useReadinessCheck } from 'graphql-yoga';

import { APP_ENV, loadConfig } from '@/config.ts';
import {
  dealMonitorItemDefer,
  getDealMonitorQuery,
  listDealMonitorsQuery,
} from '@/deal-monitor.query.ts';
import { createLogger } from '@/logger.ts';
import {
  searchProductQuery,
  searchProductStream,
} from '@/search-product.query.ts';
import type { GraphqlContext, Product } from '@/types.ts';

import { createDatabaseConnection, databaseHealthCheck } from './database.ts';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);

export const schema = {
  resolvers: {
    GetDealMonitorResult: {
      items: dealMonitorItemDefer,
    },
    Product: {
      pricePerItem: (product: Product) => {
        if (!product.pricePerItem) return null;
        function splitPricePerItem(pricePerItem: string) {
          if (pricePerItem.includes('per')) {
            const [price, , pricePerUnit] = pricePerItem
              .split(' ')
              .map(text => text.trim());
            return [price, pricePerUnit];
          }
          if (pricePerItem.includes('/')) {
            const [price, pricePerUnit] = pricePerItem.split('/');
            return [price, pricePerUnit];
          }
          return null;
        }
        function parseProductPricingToNumber(price: string) {
          const isPenny = price.includes('p');
          if (isPenny) return Number(price.slice(0, -1)) / 100;
          return Number(price.slice(1));
        }
        const pricePerItemInfo = splitPricePerItem(product.pricePerItem);
        if (!pricePerItemInfo) return product.pricePerItem;
        const [price, pricePerUnit] = pricePerItemInfo;
        const pricePerUnitInPound = parseProductPricingToNumber(price);
        if (isNaN(pricePerUnitInPound)) return product.pricePerItem;
        const priceInString =
          pricePerUnitInPound < 1
            ? `${new Intl.NumberFormat('en-GB', {
                maximumFractionDigits: 1,
              }).format(pricePerUnitInPound * 100)}p`
            : new Intl.NumberFormat('en-GB', {
                currency: 'GBP',
                style: 'currency',
              }).format(pricePerUnitInPound);
        return [priceInString, pricePerUnit].join(' per ');
      },
    },
    Query: {
      dealMonitor: getDealMonitorQuery,
      dealMonitors: listDealMonitorsQuery,
      products: searchProductQuery,
    },
    SearchProductResult: {
      stream: searchProductStream,
    },
  },
  typeDefs: /* GraphQL */ `
    input SearchProductInput {
      keyword: String
    }
    type Product {
      id: String
      countryOfOrigin: String
      image: String
      title: String
      type: String
      url: String
      price: String
      pricePerItem: String
      source: String
    }
    input GetDealMonitorInput {
      monitorId: String!
    }
    enum ProductStreamType {
      FETCH_PRODUCT_DETAIL
      FETCH_PRODUCT_DETAIL_FAILURE
    }
    type ProductStream {
      type: ProductStreamType!
      data: Product
    }
    type SearchProductResult {
      requestId: String!
      stream: [ProductStream!]!
    }

    type DealMonitor {
      id: String!
      name: String!
      description: String!
      numberOfItems: Int!
    }

    type DealMonitorItem {
      type: ProductStreamType!
      data: Product
    }

    type GetDealMonitorResult {
      requestId: String!
      monitor: DealMonitor
      items: [DealMonitorItem!]!
    }

    type ListDealMonitorsResult {
      requestId: String!
      monitors: [DealMonitor!]!
    }

    type Query {
      products(input: SearchProductInput!): SearchProductResult!
      dealMonitor(input: GetDealMonitorInput!): GetDealMonitorResult!
      dealMonitors: ListDealMonitorsResult!
    }
  `,
};

export const yoga = createYoga<GraphqlContext>({
  context: async ({ params, request }) => {
    const requestId = request.headers.get('request-id') ?? randomUUID();
    const { operationName } = params;
    return {
      config,
      logger: logger.child({ operationName, requestId }),
      requestId,
    };
  },
  plugins: [
    useDeferStream(),
    useReadinessCheck({
      check: async () => {
        const [databaseHealthCheckResult] = await Promise.all([
          databaseHealthCheck(createDatabaseConnection())(),
        ]);
        const info = [
          ['database', databaseHealthCheckResult.ok ? { ok: true } : null],
        ].filter(([, result]) => result);
        const errors = [
          [
            'database',
            databaseHealthCheckResult.ok
              ? null
              : databaseHealthCheckResult.error,
          ],
        ].filter(
          (error): error is [string, { code: string; message: string }] =>
            error[1] !== null,
        );
        if (errors.length > 0) {
          throw new Error(JSON.stringify({ errors, info, ok: false }));
        }
        return true;
      },
    }),
  ],
  schema: createSchema<GraphqlContext>(schema),
});
