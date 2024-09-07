import { type MetaFunction } from '@remix-run/node';
import { useParams } from '@remix-run/react';
import type React from 'react';
import { gql, useQuery } from 'urql';

import { Page } from '@/components/Layout.tsx';
import { Loader } from '@/components/Loader.tsx';

export const meta: MetaFunction = () => {
  return [
    { title: 'Made In UK' },
    { content: 'Search product that made in UK', name: 'description' },
  ];
};

const GetDealMonitorQuery = gql`
  query getDealMonitor($input: GetDealMonitorInput!) {
    dealMonitor(input: $input) {
      requestId
      monitor {
        id
        name
        description
        numberOfItems
      }
      ... @defer {
        items {
          id
          countryOfOrigin
          image
          title
          type
          url
          price
          pricePerItem
          source
        }
      }
    }
  }
`;

export default function GoodDealsMonitor() {
  const params = useParams();
  const [matchingResults] = useQuery<
    {
      dealMonitor: {
        items: Array<{
          countryOfOrigin: string;
          id: string;
          image: string;
          price: string;
          pricePerItem: string | null;
          source: string;
          title: string;
          type: string;
          url: string;
        }>;
        monitor: {
          description: string;
          id: string;
          name: string;
          numberOfItems: number;
        };
        requestId: string;
      };
    },
    {
      input: {
        monitorId: string;
      };
    }
  >({
    query: GetDealMonitorQuery,
    variables: {
      input: {
        monitorId: params['monitorId']!,
      },
    },
  });
  if (matchingResults.fetching)
    return (
      <Page className={'tw-mx-auto tw-pb-2'}>
        <Page.Header
          className={
            'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white tw-pb-2'
          }
        >
          <h1 className={'tw-text-center tw-text-2xl'}>Deal Monitor</h1>
        </Page.Header>
        <Page.Main>
          <ul
            className={
              'tw-grid tw-grid-cols-1 tw-gap-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 2xl:tw-grid-cols-8'
            }
          >
            {Array.from({ length: 16 }).map((_, index) => (
              <li key={index}>
                <Loader className={'tw-m-1 tw-h-16'} />
              </li>
            ))}
          </ul>
        </Page.Main>
      </Page>
    );
  if (matchingResults.error)
    return (
      <Page className={'tw-mx-auto tw-pb-2'}>
        <Page.Header
          className={
            'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white tw-pb-2'
          }
        >
          <h1 className={'tw-text-center tw-text-2xl'}>Deal Monitor</h1>
        </Page.Header>
        <Page.Main>
          <pre>{JSON.stringify(matchingResults.error, null, 4)}</pre>
        </Page.Main>
      </Page>
    );
  const isEndofStream =
    // @ts-expect-error - `hasNext` is not defined in the type
    !matchingResults.fetching && !matchingResults['hasNext'];
  const monitor = matchingResults.data?.dealMonitor;
  if (!monitor) return;
  return (
    <Page className={'tw-mx-auto tw-pb-2'}>
      <Page.Header
        className={
          'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white tw-pb-2'
        }
      >
        <section className={'tw-text-center'}>
          <h1 className={'tw-text-2xl'}>{monitor.monitor.name}</h1>
          <p>{monitor.monitor.description}</p>
        </section>
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <ul
          className={
            'tw-grid tw-grid-cols-1 tw-gap-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 2xl:tw-grid-cols-8'
          }
        >
          {!isEndofStream &&
            Array.from({ length: monitor.monitor.numberOfItems }).map(
              (_, index) => (
                <li key={index}>
                  <Loader className={'tw-m-1 tw-h-16'} />
                </li>
              ),
            )}
          {isEndofStream &&
            monitor.items
              .toSorted((productA, productB) => {
                const productAPricing = Number(productA.price.slice(1));
                const productBPricing = Number(productB.price.slice(1));
                return productAPricing - productBPricing;
              })
              .toSorted((productA, productB) => {
                const productAPricePerItem = productA.pricePerItem;
                const productBPricePerItem = productB.pricePerItem;
                if (!productAPricePerItem || !productBPricePerItem) return 0;
                const [productAPricing, productAPricingUnit] =
                  productAPricePerItem.split('/');
                const [productBPricing, productBPricingUnit] =
                  productBPricePerItem.split('/');
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
              .map(item => {
                return (
                  <li key={item.id}>
                    <a
                      className={
                        'tw-box-border tw-flex tw-flex-col tw-items-center tw-border tw-border-solid tw-border-transparent hover:tw-border-primary-user-action'
                      }
                      href={item.url}
                      rel="noreferrer"
                      target={'_blank'}
                    >
                      <img
                        alt={item.title}
                        className={'tw-h-16 tw-object-contain'}
                        src={item.image}
                      />
                      <h1
                        className={'tw-text-center tw-text-xl tw-font-semibold'}
                      >
                        {item.title}
                      </h1>
                      <p className={'tw-py-0.5 tw-text-lg tw-font-semibold'}>
                        {item.pricePerItem}
                      </p>
                      <p className={'tw-py-0.5 tw-text-base tw-font-semibold'}>
                        {item.price}
                      </p>
                      <p className={'tw-py-0.5 tw-text-base tw-font-semibold'}>
                        {item.source}
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
