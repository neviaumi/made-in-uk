import { json, type MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { print } from 'graphql';
import type React from 'react';
import { gql } from 'urql';

import { Page } from '@/components/Layout.tsx';
import { createAPIFetchClient } from '@/fetch.server.ts';

export const meta: MetaFunction = () => {
  return [
    { title: 'Made In UK' },
    { content: 'Search product that made in UK', name: 'description' },
  ];
};

const GetDealMonitorQuery = gql`
  query listDealMonitor {
    dealMonitors {
      requestId
      monitors {
        id
        name
        description
        numberOfItems
      }
    }
  }
`;

export async function loader() {
  return json(
    await createAPIFetchClient()('/graphql', {
      body: JSON.stringify({
        query: print(GetDealMonitorQuery),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }).then(response => response.json()),
  );
}

export default function GoodDealsMonitorListing() {
  const {
    data: { dealMonitors },
  }: {
    data: {
      dealMonitors: {
        monitors: Array<{
          description: string;
          id: string;
          name: string;
          numberOfItems: number;
        }>;
        requestId: string;
      };
    };
  } = useLoaderData();
  console.log(dealMonitors);
  return (
    <Page className={'tw-mx-auto tw-pb-2'}>
      <Page.Header
        className={
          'tw-sticky tw-top-0 tw-z-10 tw-border-b tw-border-solid tw-border-b-primary tw-bg-white tw-py-2'
        }
      >
        <h1 className={'tw-text-center'}>Deal Monitors</h1>
      </Page.Header>
      <Page.Main className={'tw-pt-2'}>
        <ul
          className={
            'tw-grid tw-grid-cols-1 tw-gap-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 2xl:tw-grid-cols-8'
          }
        >
          {dealMonitors.monitors.map(monitor => {
            return (
              <li key={monitor.id}>
                <a
                  className={
                    'tw-box-border tw-flex tw-flex-col tw-items-center tw-border tw-border-solid tw-border-transparent hover:tw-border-primary-user-action'
                  }
                  href={`/deal-monitor/${monitor.id}`}
                  rel="noreferrer"
                  target={'_self'}
                >
                  <h1 className={'tw-text-center tw-text-xl tw-font-semibold'}>
                    {monitor.name}
                  </h1>
                  <p className={'tw-py-0.5 tw-text-base tw-font-semibold'}>
                    {monitor.description}
                  </p>
                  <p className={'tw-py-0.5 tw-text-base tw-font-semibold'}>
                    Contain {monitor.numberOfItems} items
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
