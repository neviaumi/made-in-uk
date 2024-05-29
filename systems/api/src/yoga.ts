import { randomUUID } from 'node:crypto';

import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { createSchema, createYoga } from 'graphql-yoga';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger } from '@/logging/logger.ts';
import { searchProductQuery } from '@/resolvers/search-product.query.ts';
import type { GraphqlContext } from '@/types/utilities';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);

export const schema = {
  resolvers: {
    Query: {
      searchProduct: searchProductQuery,
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
    }
    type Query {
      searchProduct(input: SearchProductInput!): [Product!]!
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
  plugins: [useDeferStream()],
  schema: createSchema<GraphqlContext>(schema),
});
