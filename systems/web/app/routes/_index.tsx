import { Button, Field, Input } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { json, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { gql, useQuery } from 'urql';

import { Page } from '@/components/Layout.tsx';
import { Loader } from '@/components/Loader.tsx';

const ukCountries = ['United Kingdom', 'UK', 'England'];

export const meta: MetaFunction = () => {
  return [
    { title: 'Made In UK' },
    { content: 'Search product that made in UK', name: 'description' },
  ];
};

const SearchProducts = gql`
  query searchProducts($input: SearchProductInput!) {
    searchProduct(input: $input) {
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
  return json({
    ENV: {
      WEB_ENV: process.env['WEB_ENV'],
    },
  });
}

export default function Index() {
  const { ENV } = useLoaderData<typeof loader>();
  const searchForm = useRef<HTMLFormElement>(null);
  const [matchingFilters, setMatchingFilters] = useState<{
    keyword: string;
  }>({
    keyword: '',
  });
  const [matchingResults] = useQuery<
    {
      searchProduct: {
        requestId: string;
        stream: Array<{
          data: {
            countryOfOrigin: string;
            id: string;
            image: string;
            price: string;
            pricePerItem: string | null;
            title: string;
            type: string;
            url: string;
          };
          type: string;
        }>;
      };
    },
    { input: typeof matchingFilters }
  >({
    pause: matchingFilters.keyword.length === 0,
    query: SearchProducts,
    variables: {
      input: matchingFilters,
    },
  });
  const { data, error, fetching } = matchingResults;
  // @ts-expect-error type error
  const isEndOfStream = !fetching && matchingResults['hasNext'] === false;
  // eslint-disable-next-line no-console
  console.log({
    ENV,
    data,
    error,
    fetching,
  });
  return (
    <Page className={'tw-mx-auto tw-pb-2'}>
      <Page.Header
        className={
          'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white tw-py-2'
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
                {data.searchProduct.stream.length}
              </span>
            </p>
            <p>Request Id: {data.searchProduct.requestId}</p>

            {!isEndOfStream && (
              <p className={'tw-text-sm'}>More product loading...</p>
            )}
          </section>
        )}
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <article>
          {isEndOfStream && data && data.searchProduct.stream.length === 0 && (
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
              data.searchProduct.stream
                .filter(({ type }) => type === 'FETCH_PRODUCT_DETAIL')
                .toSorted((productA, productB) => {
                  if (!isEndOfStream) return 0;
                  if (
                    !ukCountries.includes(productA.data.countryOfOrigin) &&
                    !ukCountries.includes(productB.data.countryOfOrigin)
                  )
                    return 0;
                  if (
                    ukCountries.includes(productA.data.countryOfOrigin) &&
                    ukCountries.includes(productB.data.countryOfOrigin)
                  )
                    return 0;
                  if (ukCountries.includes(productA.data.countryOfOrigin))
                    return -1;
                  if (ukCountries.includes(productB.data.countryOfOrigin))
                    return 1;
                  return 0;
                })
                .toSorted((productA, productB) => {
                  if (!isEndOfStream) return 0;
                  const isOneOfProductIsMadeInUk =
                    (ukCountries.includes(productA.data.countryOfOrigin) &&
                      !ukCountries.includes(productB.data.countryOfOrigin)) ||
                    (!ukCountries.includes(productA.data.countryOfOrigin) &&
                      ukCountries.includes(productB.data.countryOfOrigin));
                  if (isOneOfProductIsMadeInUk) return 0;
                  const productAPricing = Number(productA.data.price.slice(1));
                  const productBPricing = Number(productB.data.price.slice(1));
                  return productAPricing - productBPricing;
                })
                .toSorted((productA, productB) => {
                  if (!isEndOfStream) return 0;
                  const isOneOfProductIsMadeInUk =
                    (ukCountries.includes(productA.data.countryOfOrigin) &&
                      !ukCountries.includes(productB.data.countryOfOrigin)) ||
                    (!ukCountries.includes(productA.data.countryOfOrigin) &&
                      ukCountries.includes(productB.data.countryOfOrigin));
                  if (isOneOfProductIsMadeInUk) return 0;
                  const productAPricePerItem = productA.data.pricePerItem;
                  const productBPricePerItem = productB.data.pricePerItem;
                  if (!productAPricePerItem || !productBPricePerItem) return 0;
                  const [productAPricing, , productAPricingUnit] =
                    productAPricePerItem.split(' ');
                  const [productBPricing, , productBPricingUnit] =
                    productBPricePerItem.split(' ');
                  if (productAPricingUnit !== productBPricingUnit) return 0;
                  const parseProductPricingToNumber = (price: string) => {
                    const isPenny = price.includes('p');
                    if (isPenny) return Number(price.slice(0, -1)) / 100;
                    return Number(price.slice(1));
                  };
                  return (
                    parseProductPricingToNumber(productAPricing) -
                    parseProductPricingToNumber(productBPricing)
                  );
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
                        {product.price}
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
