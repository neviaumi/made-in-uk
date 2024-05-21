import type { MetaFunction } from '@remix-run/node';
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
    }
  }
`;

export default function Index() {
  // const loaderData = useLoaderData<typeof loader>();
  const [result] = useQuery({
    query: SearchProducts,
    variables: {
      input: {
        keyword: 'beer',
      },
    },
  });
  const { data, error, fetching } = result;

  return (
    <Page>
      <Page.Header>
        <h1>Remix App</h1>
      </Page.Header>
      <Page.Main>
        {fetching && <span>Loading...</span>}
        {!fetching && (
          <article>
            <ul>
              <li></li>
            </ul>
            <pre className={'tw-text-primary'}>
              {JSON.stringify(data, null, 4)}
            </pre>
          </article>
        )}
      </Page.Main>
    </Page>
  );
}
