import { Duplex } from 'node:stream';

import { Await, useLoaderData } from '@remix-run/react';
import { createClient, fetchExchange } from '@urql/core';
import type React from 'react';
import { Suspense } from 'react';

import { Page } from '@/components/Layout.tsx';
import { Loader } from '@/components/Loader.tsx';
import { NavBar } from '@/components/Nav/Nav.tsx';
import { APP_ENV } from '@/config.server.ts';
import type {
  LoaderFunctionArgs,
  MetaFunction,
} from '@/deps/@remix-run/node.server.ts';
import { defer } from '@/deps/@remix-run/node.server.ts';
import { gql } from '@/deps/urql.ts';
import { createAPIFetchClient, withCustomBodyTimeout } from '@/fetch.server.ts';
import { createLogger, formatURQLResult } from '@/logger.server.ts';
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
import {
  getCurrentSession,
  getSessionCookie,
  isAuthSessionExist,
  redirectToAuthPage,
} from '@/routes/auth/sessions.server.ts';

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

export async function loader({ params, request }: LoaderFunctionArgs) {
  if (!(await isAuthSessionExist({ request }))) {
    return redirectToAuthPage({ request });
  }
  const { monitorId } = params;
  const requestId = crypto.randomUUID();
  const logger = createLogger(APP_ENV).child({
    request: {
      url: new URL(request.url).pathname,
    },
    requestId,
  });

  const responseStream = new Duplex({
    final() {
      this.push(null);
    },
    objectMode: true,
    read() {},
  });
  const { unsubscribe } = createClient({
    exchanges: [fetchExchange],
    fetch: withCustomBodyTimeout(900 * 1000)(createAPIFetchClient('undici')),
    url: '/graphql',
  })
    .query<
      unknown,
      {
        input: {
          monitorId: string;
        };
      }
    >(
      GetDealMonitorQuery,
      {
        input: {
          monitorId: String(monitorId),
        },
      },
      {
        fetchOptions: {
          headers: {
            SessionCookie: getSessionCookie(
              await getCurrentSession({ request }),
            ),
            'request-id': requestId,
          },
        },
      },
    )
    .subscribe(result => {
      if (responseStream.destroyed) {
        logger.warn('Response stream is destroyed');
        unsubscribe();
        return;
      }
      responseStream.push(result);
    });
  const { monitor } = await new Promise<{
    monitor: {
      description: string;
      id: string;
      name: string;
      numberOfItems: number;
    };
  }>((resolve, reject) => {
    responseStream.once('data', result => {
      if (result.error) {
        return reject(result.error);
      }
      const { monitor } = result.data.dealMonitor;

      logger.info('First response', { result: formatURQLResult(result) });
      resolve({ monitor });
    });
  });
  const items = new Promise<Array<AsyncProductError | AsyncProductSuccess>>(
    (resolve, reject) => {
      responseStream.once('data', result => {
        logger.info('Deferred response', { result: formatURQLResult(result) });
        if (result.error) return reject(result.error);
        const { items } = result.data.dealMonitor;
        resolve(items);
      });
    },
  ).finally(() => {
    try {
      responseStream.destroy();
    } catch (e) {
      logger.error('Error when destroying response stream', { error: e });
    }
  });
  const isItemsContainError = new Promise<boolean>(resolve => {
    items.then(items => {
      resolve(items.some(isFailureProductResponse));
      return items;
    });
  });

  return defer({ isItemsContainError, items, monitor, requestId });
}

export default function GoodDealsMonitor() {
  useAuth();
  const loaderData = useLoaderData<typeof loader>();

  const monitor = loaderData.monitor;
  const requestId = loaderData.requestId;
  if (!monitor) return;

  return (
    <Page className={'tw-mx-auto tw-pb-2'}>
      <Page.Header
        className={
          'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white tw-pb-2'
        }
      >
        <NavBar />
        <section className={'tw-text-center'}>
          <h1 className={'tw-text-2xl'}>{monitor.name}</h1>
          <p>{monitor.description}</p>
          <span className={'tw-block'}>
            Contain {monitor.numberOfItems} items
          </span>
          <Suspense fallback={<></>}>
            <Await resolve={loaderData.isItemsContainError}>
              {isItemsContainError => {
                return isItemsContainError ? (
                  <h2 className={'tw-block'}>Request Id: {requestId}</h2>
                ) : (
                  <></>
                );
              }}
            </Await>
          </Suspense>
        </section>
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <ul
          className={
            'tw-grid tw-grid-cols-1 tw-gap-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 2xl:tw-grid-cols-8'
          }
        >
          <Suspense
            fallback={Array.from({ length: monitor.numberOfItems }).map(
              (_, index) => (
                <li key={index}>
                  <Loader className={'tw-m-1 tw-h-16'} />
                </li>
              ),
            )}
          >
            <Await
              errorElement={Array.from({ length: monitor.numberOfItems }).map(
                (_, index) => (
                  <li className={'tw-group'} key={index}>
                    <ErrorItem />
                    <h1
                      className={'tw-text-center tw-text-xl tw-font-semibold'}
                    >
                      Refresh or report to admin with requestId
                    </h1>
                  </li>
                ),
              )}
              resolve={loaderData.items}
            >
              {items => {
                return items
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
                    if (pricePerItemSortResult !== 0)
                      return pricePerItemSortResult;

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
                            <p
                              className={
                                'tw-py-0.5 tw-text-lg tw-font-semibold'
                              }
                            >
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
                              className={
                                'tw-py-0.5 tw-text-base tw-font-semibold'
                              }
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
                  });
              }}
            </Await>
          </Suspense>
        </ul>
      </Page.Main>
    </Page>
  );
}
