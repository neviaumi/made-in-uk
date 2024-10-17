import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { createClient, fetchExchange, gql } from '@urql/core';
import type React from 'react';

import { Page } from '@/components/Layout.tsx';
import {
  SearchProgress,
  SearchStatusBadge,
} from '@/components/mall.search-history.tsx';
import { NavBar } from '@/components/Nav/Nav.tsx';
import { withErrorCode } from '@/error.ts';
import { createAPIFetchClient } from '@/fetch.server.ts';
import {
  getCurrentSession,
  getSessionCookie,
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
        meta {
          input {
            keyword
          }
          completed
          docsReceived
          isError
          requestedAt
          totalDocsExpected
        }
      }
    }
  }
`;

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await isAuthSessionExist({ request }))) {
    return redirectToAuthPage({ request });
  }
  const resp = await createClient({
    exchanges: [fetchExchange],
    fetch: createAPIFetchClient(),
    fetchOptions: {
      headers: {
        SessionCookie: getSessionCookie(await getCurrentSession({ request })),
      },
    },
    url: '/graphql',
  }).query<{
    productSearchHistories: {
      requestId: string;
      searchHistories: Array<{
        id: string;
        meta: {
          completed: boolean;
          docsReceived: number;
          input: {
            keyword: string;
          };
          isError: boolean;
          requestedAt: string;
          totalDocsExpected: number | null;
        };
      }>;
    };
  }>(ListProductSearchHistoriesQuery, {});
  return json(resp);
}

export default function ProductSearchHistoryListing() {
  const loaderData = useLoaderData<typeof loader>();
  if (!loaderData.data)
    throw withErrorCode('ERR_UNEXPECTED_ERROR')(
      new Error('Loader data is missing'),
    );
  const { productSearchHistories } = loaderData.data;
  return (
    <Page className={'tw-mx-auto tw-pb-2'}>
      <Page.Header
        className={
          'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white  tw-pb-2'
        }
      >
        <NavBar />
        <h1 className={'tw-text-center'}>Search History</h1>
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <ul
          className={
            'tw-grid tw-grid-cols-1 tw-gap-1 lg:tw-grid-cols-2 2xl:tw-grid-cols-3'
          }
        >
          {productSearchHistories.searchHistories.map(searchHistory => {
            const { meta: searchHistoryMeta } = searchHistory;
            return (
              <li key={searchHistory.id}>
                <a
                  className={
                    'tw-flex tw-flex-col tw-gap-1 tw-border tw-border-solid tw-border-transparent tw-p-2 hover:tw-border-primary-user-action'
                  }
                  href={`/mall/search-history/${searchHistory.id}`}
                  rel="noreferrer"
                  target={'_self'}
                >
                  <section
                    className={
                      'tw-flex tw-flex-row tw-items-center tw-justify-around'
                    }
                  >
                    <div>
                      <h1 className={'tw-text-center tw-text-xl'}>
                        Search for{' '}
                        <b className={'tw-font-semibold'}>
                          {searchHistoryMeta.input.keyword}
                        </b>
                      </h1>
                    </div>
                    <div>
                      <SearchStatusBadge searchHistory={searchHistoryMeta} />
                    </div>
                  </section>
                  <SearchProgress searchHistory={searchHistoryMeta} />
                  <section>
                    <p
                      className={'tw-text-center tw-text-base tw-font-semibold'}
                    >
                      Contain {searchHistoryMeta.docsReceived} items
                    </p>
                    <p className={'tw-text-center'}>
                      {new Date(searchHistoryMeta.requestedAt).toLocaleString(
                        'en-GB',
                        {
                          hourCycle: 'h24',
                        },
                      )}
                    </p>
                  </section>
                </a>
              </li>
            );
          })}
        </ul>
      </Page.Main>
    </Page>
  );
}
