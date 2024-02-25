import { describe, expect, it } from '@jest/globals';
import gql from 'graphql-tag';

import { getApolloServer } from '../test-helpers/get-apollo-server';
import {
  createOverrideTestingServer,
  withAPIServer,
} from '../test-helpers/with-api-server';
import {
  withDatabase,
  withDatabaseCleanup,
} from '../test-helpers/with-database';

describe('Visit Count Resolver', () => {
  const appContext = withAPIServer(
    createOverrideTestingServer(modBuilder => {
      return withDatabase('visit-count-test')(modBuilder);
    }),
  );
  withDatabaseCleanup('visit-count-test');
  it('get visit count', async () => {
    const app = appContext.app;
    const server = getApolloServer(app);
    const GET_VISIT_COUNT = gql`
      query getVisitCount {
        visitCount {
          count
        }
      }
    `;
    const resp = await server.executeOperation({
      query: GET_VISIT_COUNT,
    });
    expect(resp.errors).toBeUndefined();
    expect(resp.data?.['visitCount']?.['count']).toEqual(0);
  });

  it('trigger visit count', async () => {
    const app = appContext.app;
    const server = getApolloServer(app);
    const TRIGGER_VISIT_COUNT = gql`
      mutation triggerVisitCount {
        incrementVisitCount {
          count
        }
      }
    `;
    const triggerVisitResp = await server.executeOperation({
      query: TRIGGER_VISIT_COUNT,
    });
    expect(triggerVisitResp.errors).toBeUndefined();
    const resp = await server.executeOperation({
      query: gql`
        query getVisitCount {
          visitCount {
            count
          }
        }
      `,
    });
    expect(resp.data?.['visitCount']?.['count']).toEqual(1);
  });
});
