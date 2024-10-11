import { Button, Field, Input } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { createClient, fetchExchange } from '@urql/core';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { gql, useQuery } from 'urql';

import { Page } from '@/components/Layout.tsx';
import { Loader } from '@/components/Loader.tsx';
import { ProductListItem } from '@/components/mall.tsx';
import { NavBar } from '@/components/Nav.tsx';
import { APP_ENV, loadConfig } from '@/config.server.ts';
import { withErrorCode } from '@/error.server.ts';
import { createAPIFetchClient } from '@/fetch.server.ts';
import {
  type AsyncProductSuccess,
  sortByCountryOfOrigin,
  sortByPrice,
  sortByPricePerItem,
} from '@/product.ts';
import { useAuth } from '@/routes/auth/auth.hook.ts';
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

const SearchProductsQuery = gql`
  query searchProducts($input: SearchProductInput!) {
    products(input: $input) {
      requestId
      stream @stream {
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
      searchHistories: Array<{
        id: string;
      }>;
    };
  }>(
    gql`
      query getProductSearchHistoriesLength {
        productSearchHistories {
          searchHistories {
            id
          }
        }
      }
    `,
    {},
  );
  const config = loadConfig(APP_ENV);

  if (!resp.data) {
    throw withErrorCode('ERR_UNEXPECTED_ERROR')(
      new Error('No data returned from the server'),
    );
  }

  return json({
    ENV: {
      WEB_ENV: config.get('env'),
    },
    shouldShowSearchHistory:
      resp.data.productSearchHistories.searchHistories.length > 0,
  });
}

export default function Index() {
  useAuth();
  const loaderData = useLoaderData<typeof loader>();
  const searchForm = useRef<HTMLFormElement>(null);
  const [matchingFilters, setMatchingFilters] = useState<{
    keyword: string;
  }>({
    keyword: '',
  });
  const [matchingResults] = useQuery<
    {
      productSearchHistories: {
        searchHistories: Array<{
          id: string;
        }>;
      };
      products: {
        requestId: string;
        stream: Array<AsyncProductSuccess>;
      };
    },
    { input: typeof matchingFilters }
  >({
    pause: matchingFilters.keyword.length === 0,
    query: SearchProductsQuery,
    variables: {
      input: matchingFilters,
    },
  });
  const { data, error, fetching } = matchingResults;
  // @ts-expect-error type error
  const isEndOfStream = !fetching && matchingResults['hasNext'] === false;
  const shouldShowSearchHistoryButton =
    loaderData.shouldShowSearchHistory || isEndOfStream;
  return (
    <Page className={'tw-mx-auto tw-pb-2'}>
      <Page.Header
        className={
          'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white tw-pb-2'
        }
      >
        <NavBar />
        <form
          className={
            'tw-mx-auto tw-flex tw-h-5.5 tw-w-35 tw-items-center tw-gap-1'
          }
          onSubmit={useCallback(
            (e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              setMatchingFilters({
                keyword: formData.get('keyword') as string,
              });
            },
            [setMatchingFilters],
          )}
          ref={searchForm}
        >
          <Field className={'tw-flex tw-flex-col'}>
            <Input
              className={
                'tw-form-input tw-rounded-xl tw-border-primary hover:tw-border-primary-user-action focus:tw-border-primary-user-action focus:tw-outline-0 focus:tw-ring-0'
              }
              name={'keyword'}
              onChange={useCallback(
                (e: React.ChangeEvent<HTMLInputElement>) => {
                  e.currentTarget.setAttribute('value', e.currentTarget.value);
                },
                [],
              )}
              placeholder={'Find a product'}
              type={'search'}
            />
          </Field>
          <Button
            className={
              'tw-h-5.5 tw-w-5 tw-rounded-xl tw-bg-primary tw-p-1 tw-font-bold tw-text-primary hover:tw-bg-primary-user-action hover:tw-text-primary-user-action'
            }
            type={'submit'}
          >
            <MagnifyingGlassIcon />
          </Button>
        </form>
        <Link
          className={
            shouldShowSearchHistoryButton
              ? 'tw-mx-auto tw-mt-2 tw-flex tw-w-16 tw-rounded-xl tw-bg-secondary tw-p-1 tw-text-secondary hover:tw-bg-secondary-user-action hover:tw-text-secondary-user-action'
              : 'tw-hidden'
          }
          to={'/mall/search-history'}
        >
          Search History
        </Link>
        {!fetching && data && (
          <section
            className={
              'tw-mx-auto tw-mt-2 tw-flex tw-w-52 tw-flex-col tw-gap-0.5 tw-text-center'
            }
          >
            <p className={'tw-text-lg'}>
              Number of products streamed:{' '}
              <span className={'tw-font-bold'}>
                {data.products.stream.length}
              </span>
            </p>
            <p>Request Id: {data.products.requestId}</p>

            {!isEndOfStream && (
              <p className={'tw-text-sm'}>More product loading...</p>
            )}
          </section>
        )}
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <article>
          {isEndOfStream && data && data.products.stream.length === 0 && (
            <section className={'tw-flex tw-flex-col tw-gap-2 tw-text-center'}>
              <header className={'tw-text-6xl tw-font-extrabold'}>
                👀 Can&apos;t see the 💩 Captain!
              </header>
              <p className={'tw-text-3xl tw-font-semibold'}>
                No products matched for keyword {`"${matchingFilters.keyword}"`}
              </p>
            </section>
          )}
          {error && !fetching && isEndOfStream && (
            <pre>{JSON.stringify(matchingResults, null, 4)}</pre>
          )}
          <ul
            className={
              'tw-grid tw-grid-cols-1 tw-gap-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 2xl:tw-grid-cols-8'
            }
          >
            {fetching &&
              Array.from({ length: 8 }).map((_, index) => (
                <Loader className={'tw-h-16 '} key={index} />
              ))}
            {!fetching &&
              data &&
              data.products.stream
                .toSorted((productA, productB) => {
                  if (!isEndOfStream) return 0;
                  const countrySortResult = sortByCountryOfOrigin(
                    productA,
                    productB,
                  );
                  if (countrySortResult !== 0) return countrySortResult;

                  const pricePerItemSortResult = sortByPricePerItem(
                    productA,
                    productB,
                  );
                  if (pricePerItemSortResult !== 0)
                    return pricePerItemSortResult;

                  return sortByPrice(productA, productB);
                })
                .map(({ data: product }) => (
                  <ProductListItem key={product.id} product={product} />
                ))}
            {!isEndOfStream &&
              data !== undefined &&
              Array.from({ length: 8 }).map((_, index) => (
                <Loader className={'tw-h-16'} key={index} />
              ))}
          </ul>
        </article>
      </Page.Main>
    </Page>
  );
}
