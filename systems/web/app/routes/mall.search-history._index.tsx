import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { print } from 'graphql';
import type React from 'react';
import { gql } from 'urql';

import { Page } from '@/components/Layout.tsx';
import { APP_ENV } from '@/config.server.ts';
import { withErrorCode } from '@/error.server.ts';
import { createAPIFetchClient } from '@/fetch.server.ts';
import { createLogger } from '@/logger.server.ts';
import {
  getCurrentSession,
  isAuthSessionExist,
  redirectToAuthPage,
} from '@/routes/auth/sessions.server.ts';

export const meta: MetaFunction = () => {
  return [
    { title: 'Made In UK' },
    { content: 'Search product that made in UK', name: 'description' },
  ];
};

const ListProductSearchHistoriesQuery = gql`
  query listProductSearchHistories {
    productSearchHistories {
      requestId
      searchHistories {
        id
        input {
          keyword
        }
        completed
        docsReceived
        isError
        requestedAt
      }
    }
  }
`;

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await isAuthSessionExist({ request }))) {
    return redirectToAuthPage({ request });
  }
  const logger = createLogger(APP_ENV);
  return json(
    await createAPIFetchClient()('/graphql', {
      body: JSON.stringify({
        query: print(ListProductSearchHistoriesQuery),
      }),
      headers: {
        'Content-Type': 'application/json',
        SessionCookie: await getCurrentSession({ request }),
      },
      method: 'POST',
    }).then(async response => {
      if (!response.ok)
        throw withErrorCode('ERR_UNEXPECTED_ERROR')(
          new Error('Failed to fetch data'),
        );
      const resp = await response.json();
      logger.info('Fetched search history data', { resp });
      return resp;
    }),
  );
}

export default function ProductSearchHistoryListing() {
  const {
    data: { productSearchHistories },
  }: {
    data: {
      productSearchHistories: {
        requestId: string;
        searchHistories: Array<{
          completed: boolean;
          docsReceived: boolean;
          id: string;
          input: {
            keyword: string;
          };
          isError: boolean;
          requestedAt: string;
        }>;
      };
    };
  } = useLoaderData();
  return (
    <Page className={'tw-mx-auto tw-pb-2'}>
      <Page.Header
        className={
          'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white  tw-pb-2'
        }
      >
        <h1 className={'tw-text-center'}>Search History</h1>
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <ul
          className={
            'tw-grid tw-grid-cols-1 tw-gap-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 2xl:tw-grid-cols-8'
          }
        >
          {productSearchHistories.searchHistories.map(searchHistory => {
            return (
              <li key={searchHistory.id}>
                <a
                  className={
                    'tw-box-border tw-flex tw-flex-col tw-items-center tw-border tw-border-solid tw-border-transparent hover:tw-border-primary-user-action'
                  }
                  href={`/mall/search-history/${searchHistory.id}`}
                  rel="noreferrer"
                  target={'_self'}
                >
                  <h1 className={'tw-text-center tw-text-xl tw-font-semibold'}>
                    {searchHistory.input.keyword}
                  </h1>
                  <p className={'tw-py-0.5 tw-text-base tw-font-semibold'}>
                    Contain {searchHistory.docsReceived} items
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
      </Page.Main>
    </Page>
  );
}
