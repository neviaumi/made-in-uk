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
import type { GraphqlContext } from '@/types.ts';

import { createDatabaseConnection, databaseHealthCheck } from './database.ts';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);

export const schema = {
  resolvers: {
    GetDealMonitorResult: {
      items: dealMonitorItemDefer,
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
