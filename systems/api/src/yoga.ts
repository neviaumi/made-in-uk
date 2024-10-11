import { randomUUID } from 'node:crypto';

import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import {
  DateTimeISOResolver,
  DateTimeISOTypeDefinition,
} from 'graphql-scalars';
import {
  createSchema,
  createYoga,
  type Plugin,
  useLogger,
  useReadinessCheck,
} from 'graphql-yoga';

import { useAuth } from '@/auth.ts';
import { APP_ENV } from '@/config.ts';
import {
  dealMonitorItemDefer,
  getDealMonitorQuery,
  listDealMonitorsQuery,
} from '@/deal-monitor.query.ts';
import { createLogger, toYogaLogger } from '@/logger.ts';
import {
  productSearchHistoriesQuery,
  productSearchHistoryItemQuery,
  productSearchHistoryMetaQuery,
  productSearchHistoryQuery,
  searchProductQuery,
  searchProductStream,
} from '@/search-product.query.ts';
import type { GraphqlContext, Product } from '@/types.ts';

import { createDatabaseConnection, databaseHealthCheck } from './database.ts';

const logger = createLogger(APP_ENV);

export const schema = {
  resolvers: {
    DateTimeISO: DateTimeISOResolver,
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
    ProductSearchHistory: {
      items: productSearchHistoryItemQuery,
      meta: productSearchHistoryMetaQuery,
    },
    Query: {
      dealMonitor: getDealMonitorQuery,
      dealMonitors: listDealMonitorsQuery,
      productSearchHistories: productSearchHistoriesQuery,
      productSearchHistory: productSearchHistoryQuery,
      products: searchProductQuery,
    },
    SearchProductResult: {
      stream: searchProductStream,
    },
  },
  typeDefs: /* GraphQL */ `
    ${DateTimeISOTypeDefinition}
    input SearchProductInput {
      keyword: String
    }
    type SearchProductFilter {
      keyword: String
    }
    type Product {
      id: ID!
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
      requestId: ID!
      stream: [ProductStream!]!
    }

    type DealMonitor {
      id: ID!
      name: String!
      description: String!
      numberOfItems: Int!
    }

    type DealMonitorItem {
      type: ProductStreamType!
      data: Product
    }

    type GetDealMonitorResult {
      requestId: ID!
      monitor: DealMonitor
      items: [DealMonitorItem!]!
    }

    type ListDealMonitorsResult {
      requestId: ID!
      monitors: [DealMonitor!]!
    }

    type ProductSearchHistoryMeta {
      completed: Boolean
      docsReceived: Int
      input: SearchProductFilter
      isError: Boolean
      requestedAt: DateTimeISO!
      totalDocsExpected: Int
    }
    type ProductSearchHistory {
      meta: ProductSearchHistoryMeta!
      id: ID!
      items: [ProductStream!]!
    }

    type ListProductSearchHistoriesResult {
      requestId: ID!
      searchHistories: [ProductSearchHistory!]!
    }

    type GetProductSearchHistoryResult {
      requestId: ID!
      searchHistory: ProductSearchHistory
    }

    input GetProductSearchHistoryInput {
      requestId: ID!
    }

    type Query {
      productSearchHistories: ListProductSearchHistoriesResult!
      productSearchHistory(
        input: GetProductSearchHistoryInput!
      ): GetProductSearchHistoryResult!
      products(input: SearchProductInput!): SearchProductResult!
      dealMonitor(input: GetDealMonitorInput!): GetDealMonitorResult!
      dealMonitors: ListDealMonitorsResult!
    }
  `,
};

export const yoga = createYoga<GraphqlContext>({
  logging: toYogaLogger(logger),
  plugins: [
    useLogger({
      logFn: (eventName, args) => {
        return logger.info(
          eventName,
          (function formatArgs() {
            const { args: eventArgs } = args;
            return {
              operationName: eventArgs.operationName,
              requestId: eventArgs?.contextValue?.requestId,
              userId: eventArgs?.contextValue?.userId,
            };
          })(),
        );
      },
    }),
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
    useAuth(),
    (function injectCustomContext(): Plugin<GraphqlContext> {
      return {
        onContextBuilding: async ({ context, extendContext }) => {
          const request = context.request;
          const userId = context['userId'];
          const requestId = request.headers.get('request-id') ?? randomUUID();
          const { operationName } = context.params;
          extendContext({
            logger: logger.child({ operationName, requestId, userId }),
            operationName,
            requestId,
            userId,
          });
          return;
        },
      };
    })(),
  ],
  schema: createSchema<GraphqlContext>(schema),
});
