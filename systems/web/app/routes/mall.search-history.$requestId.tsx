import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { createClient, fetchExchange, gql } from '@urql/core';
import type React from 'react';

import { Page } from '@/components/Layout.tsx';
import {
  SearchProgress,
  SearchStatusBadge,
} from '@/components/mall.search-history.tsx';
import { ProductListItem } from '@/components/mall.tsx';
import { NavBar } from '@/components/Nav.tsx';
import { withErrorCode } from '@/error.server.ts';
import { createAPIFetchClient } from '@/fetch.server.ts';
import {
  type AsyncProductSuccess,
  sortByCountryOfOrigin,
  sortByPrice,
  sortByPricePerItem,
} from '@/product.ts';
import {
  getCurrentSession,
  getSessionCookie,
  isAuthSessionExist,
  redirectToAuthPage,
} from '@/routes/auth/sessions.server.ts';

const GetProductSearchHistoriesQuery = gql`
  query getProductSearchHistory($input: GetProductSearchHistoryInput!) {
    productSearchHistory(input: $input) {
      requestId
      searchHistory {
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

        items {
          type
          data {
            id
            image
            title
            type
            countryOfOrigin
            url
            price
            pricePerItem
          }
        }
      }
    }
  }
`;

export async function loader({ params, request }: LoaderFunctionArgs) {
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
    productSearchHistory: {
      requestId: string;
      searchHistory: {
        id: string;
        items: Array<AsyncProductSuccess>;
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
      };
    };
  }>(GetProductSearchHistoriesQuery, {
    input: {
      requestId: params['requestId'],
    },
  });
  return json(resp);
}
export default function ProductSearchHistory() {
  const loaderData = useLoaderData<typeof loader>();
  if (!loaderData.data)
    throw withErrorCode('ERR_UNEXPECTED_ERROR')(
      new Error('Loader data is missing'),
    );
  const searchHistory = loaderData.data.productSearchHistory.searchHistory;
  const searchHistoryMeta = searchHistory.meta;
  return (
    <Page className={'tw-mx-auto tw-pb-2'}>
      <Page.Header
        className={
          'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white tw-pb-2 tw-text-center'
        }
      >
        <NavBar />
        <h1>Search History</h1>
        <p>
          Searching for{' '}
          <b className={'tw-font-semibold'}>
            {searchHistoryMeta.input.keyword}
          </b>
        </p>
        <div
          className={
            'tw-flex tw-flex-row tw-items-center tw-justify-center tw-gap-1 tw-py-1'
          }
        >
          <SearchStatusBadge searchHistory={searchHistoryMeta} />
          <SearchProgress searchHistory={searchHistoryMeta} />
        </div>
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <ul
          className={
            'tw-grid tw-grid-cols-1 tw-gap-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 2xl:tw-grid-cols-8'
          }
        >
          {loaderData.data.productSearchHistory.searchHistory.items
            .toSorted((productA, productB) => {
              const countrySortResult = sortByCountryOfOrigin(
                productA,
                productB,
              );
              if (countrySortResult !== 0) return countrySortResult;

              const pricePerItemSortResult = sortByPricePerItem(
                productA,
                productB,
              );
              if (pricePerItemSortResult !== 0) return pricePerItemSortResult;

              return sortByPrice(productA, productB);
            })
            .map(({ data: product }) => (
              <ProductListItem key={product.id} product={product} />
            ))}
        </ul>
      </Page.Main>
    </Page>
  );
}
