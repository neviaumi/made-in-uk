import { Button, Field, Input } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { json, type MetaFunction } from '@remix-run/node';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { gql, useQuery } from 'urql';

import { Page } from '@/components/Layout.tsx';
import { Loader } from '@/components/Loader.tsx';
import { APP_ENV, loadConfig } from '@/config.server.ts';
import {
  type AsyncProductSuccess,
  sortByCountryOfOrigin,
  sortByPrice,
  sortByPricePerItem,
} from '@/product.ts';

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

export async function loader() {
  const config = loadConfig(APP_ENV);
  return json({
    ENV: {
      WEB_ENV: config.get('env'),
    },
  });
}

export default function Index() {
  const searchForm = useRef<HTMLFormElement>(null);
  const [matchingFilters, setMatchingFilters] = useState<{
    keyword: string;
  }>({
    keyword: '',
  });
  const [matchingResults] = useQuery<
    {
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

  return (
    <Page className={'tw-mx-auto tw-pb-2'}>
      <Page.Header
        className={
          'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white tw-pb-2'
        }
      >
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
                'tw-form-input tw-rounded-xl tw-border-primary focus:tw-border-primary-user-action focus:tw-outline-0 focus:tw-ring-0'
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
              'tw-h-5.5 tw-w-5 tw-rounded-xl tw-bg-primary tw-p-1 tw-font-bold tw-text-primary'
            }
            type={'submit'}
          >
            <MagnifyingGlassIcon />
          </Button>
        </form>
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
                  <li key={product.id}>
                    <a
                      className={
                        'tw-box-border tw-flex tw-flex-col tw-items-center tw-border tw-border-solid tw-border-transparent hover:tw-border-primary-user-action'
                      }
                      href={product.url}
                      rel="noreferrer"
                      target={'_blank'}
                    >
                      <img
                        alt={product.title}
                        className={'tw-h-16 tw-object-contain'}
                        src={product.image}
                      />
                      <h1
                        className={'tw-text-center tw-text-xl tw-font-semibold'}
                      >
                        {product.title}
                      </h1>
                      <p className={'tw-py-0.5 tw-text-lg tw-font-semibold'}>
                        {product.price} ({product.pricePerItem})
                      </p>
                      <p className={'tw-text-lg tw-font-medium'}>
                        {product.countryOfOrigin}
                      </p>
                    </a>
                  </li>
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
