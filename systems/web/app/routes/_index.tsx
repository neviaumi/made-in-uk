import { Button, Field, Input } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { MetaFunction } from '@remix-run/node';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { gql, useQuery } from 'urql';

import { Page } from '@/components/Layout.tsx';
import { Loader } from '@/components/Loader.tsx';

export const meta: MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    { content: 'Welcome to Remix!', name: 'description' },
  ];
};

const SearchProducts = gql`
  query searchProducts($input: SearchProductInput!) {
    searchProduct(input: $input) @stream {
      type
      data {
        id
        image
        title
        type
        countryOfOrigin
        url
      }
    }
  }
`;

export default function Index() {
  // const loaderData = useLoaderData<typeof loader>();
  const searchForm = useRef<HTMLFormElement>(null);
  const [matchingFilters, setMatchingFilters] = useState<{
    keyword: string;
  }>({
    keyword: '',
  });
  const [matchingResults] = useQuery<
    {
      searchProduct: Array<{
        data: {
          countryOfOrigin: string;
          id: string;
          image: string;
          title: string;
          type: string;
          url: string;
        };
        type: string;
      }>;
    },
    { input: typeof matchingFilters }
  >({
    pause: matchingFilters.keyword.length === 0,
    query: SearchProducts,
    variables: {
      input: matchingFilters,
    },
  });
  const { data, fetching } = matchingResults;
  // @ts-expect-error type error
  const isEndOfStream = !fetching && matchingResults['hasNext'] === false;

  return (
    <Page className={'tw-mx-auto tw-p-2'}>
      <Page.Header
        className={'tw-border-b tw-border-solid tw-border-b-primary tw-pb-2'}
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
              // executeSearchQuery();
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
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <article>
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
              data.searchProduct
                .filter(({ type }) => type === 'FETCH_PRODUCT_DETAIL')
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
