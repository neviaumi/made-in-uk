import { Content, Header, Main, Page } from '@busybox/react-components/Layout';
import type { MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { print } from 'graphql';
import gql from 'graphql-tag';

import { createFetchClient } from '../fetch.server.ts';

const fetchClient = createFetchClient('graphql', {
  headers: {
    'Content-Type': 'application/json',
  },
  method: 'POST',
});
export const meta: MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    { content: 'Welcome to Remix!', name: 'description' },
  ];
};

export async function loader() {
  const resp = await fetchClient('', {
    body: JSON.stringify({
      query: print(gql`
        query getVisitCount {
          visitCount {
            count
          }
        }
      `),
    }),
  }).then(res => res.json());
  return json(resp);
}

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  return (
    <Page>
      <Header>
        <h1>Remix App</h1>
      </Header>
      <Content>
        <Main>
          <pre className={'tw-text-primary'}>
            {JSON.stringify(loaderData, null, 4)}
          </pre>
        </Main>
      </Content>
    </Page>
  );
}
