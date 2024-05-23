import { Button, Field, Input } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { MetaFunction } from '@remix-run/node';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { gql, useQuery } from 'urql';

import { Page } from '@/components/Layout.tsx';

export const meta: MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    { content: 'Welcome to Remix!', name: 'description' },
  ];
};

const SearchProducts = gql`
  query searchProducts($input: SearchProductInput!) {
    searchProduct(input: $input) @stream {
      id
      image
      title
      type
      countryOfOrigin
      url
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
        countryOfOrigin: string;
        id: string;
        image: string;
        title: string;
        type: string;
        url: string;
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
  const { data, fetching, stale } = matchingResults;

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
        {fetching && <span>Loading...</span>}
        {data && (
          <article>
            <ul
              className={
                'tw-grid tw-grid-cols-2 tw-gap-1 md:tw-grid-cols-3 xl:tw-grid-cols-4'
              }
            >
              {data.searchProduct.map(product => (
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
              {stale && <span>More coming</span>}
            </ul>
          </article>
        )}
      </Page.Main>
    </Page>
  );
}
