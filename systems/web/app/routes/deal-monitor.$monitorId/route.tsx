import { type MetaFunction } from '@remix-run/node';
import { useParams } from '@remix-run/react';
import type React from 'react';
import { gql, useQuery } from 'urql';

import { Page } from '@/components/Layout.tsx';
import { Loader } from '@/components/Loader.tsx';
import { NavBar } from '@/components/Nav/Nav.tsx';
import {
  type AsyncProductError,
  type AsyncProductSuccess,
  isFailureProductResponse,
  isSuccessProductResponse,
  sortByPrice,
  sortByPricePerItem,
  sortFailureResponseToLatest,
} from '@/product.ts';
import { useAuth } from '@/routes/auth/auth.hook.ts';

import { ErrorItem } from './error-item.tsx';

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
          type
          data {
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
  }
`;

export default function GoodDealsMonitor() {
  const params = useParams();
  const [{ isSignedIn }] = useAuth();

  const [matchingResults] = useQuery<
    {
      dealMonitor: {
        items: Array<AsyncProductError | AsyncProductSuccess>;
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
    pause: !isSignedIn,
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
          <NavBar />
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
  const isEndOfStream =
    // @ts-expect-error - `hasNext` is not defined in the type
    !matchingResults.fetching && !matchingResults['hasNext'];
  const monitor = matchingResults.data?.dealMonitor;
  if (!monitor) return;
  const containProductWithError =
    isEndOfStream &&
    Array.isArray(monitor.items) &&
    monitor.items.some(item => isFailureProductResponse(item));
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
          <span className={'tw-block'}>
            Contain {monitor.monitor.numberOfItems} items
          </span>
          {containProductWithError && (
            <h2 className={'tw-block'}>Request Id: {monitor.requestId}</h2>
          )}
        </section>
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <ul
          className={
            'tw-grid tw-grid-cols-1 tw-gap-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 2xl:tw-grid-cols-8'
          }
        >
          {!isEndOfStream &&
            Array.from({ length: monitor.monitor.numberOfItems }).map(
              (_, index) => (
                <li key={index}>
                  <Loader className={'tw-m-1 tw-h-16'} />
                </li>
              ),
            )}
          {isEndOfStream && !Array.isArray(monitor.items) && (
            <li>
              <pre>{JSON.stringify(monitor, null, 4)}</pre>
            </li>
          )}
          {isEndOfStream &&
            Array.isArray(monitor.items) &&
            monitor.items
              .toSorted((productA, productB) => {
                const failureSortResult = sortFailureResponseToLatest(
                  productA,
                  productB,
                );
                if (failureSortResult !== 0) return failureSortResult;
                if (
                  !isSuccessProductResponse(productA) ||
                  !isSuccessProductResponse(productB)
                )
                  return 0;
                const pricePerItemSortResult = sortByPricePerItem(
                  productA,
                  productB,
                );
                if (pricePerItemSortResult !== 0) return pricePerItemSortResult;

                return sortByPrice(productA, productB);
              })
              .map(item => {
                return (
                  <li key={item.data.id}>
                    {item.type === 'FETCH_PRODUCT_DETAIL' ? (
                      <a
                        className={
                          'tw-box-border tw-flex tw-flex-col tw-items-center tw-border tw-border-solid tw-border-transparent hover:tw-border-primary-user-action'
                        }
                        href={item.data.url}
                        rel="noreferrer"
                        target={'_blank'}
                      >
                        <img
                          alt={item.data.title}
                          className={'tw-h-16 tw-object-contain'}
                          src={item.data.image}
                        />
                        <h1
                          className={
                            'tw-text-center tw-text-xl tw-font-semibold'
                          }
                        >
                          {item.data.title}
                        </h1>
                        <p className={'tw-py-0.5 tw-text-lg tw-font-semibold'}>
                          {item.data.price}
                        </p>
                        <p
                          className={
                            'tw-py-0.5 tw-text-base  tw-font-semibold tw-text-placeholder'
                          }
                        >
                          {item.data.pricePerItem}
                        </p>
                        <p
                          className={'tw-py-0.5 tw-text-base tw-font-semibold'}
                        >
                          {item.data.source}
                        </p>
                      </a>
                    ) : (
                      <div className={'tw-group'}>
                        <ErrorItem />
                        <h1
                          className={
                            'tw-text-center tw-text-xl tw-font-semibold'
                          }
                        >
                          Refresh or report to admin with requestId
                        </h1>
                      </div>
                    )}
                  </li>
                );
              })}
        </ul>
      </Page.Main>
    </Page>
  );
}
