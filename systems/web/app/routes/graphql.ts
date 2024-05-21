import { type ActionFunctionArgs } from '@remix-run/node';

import { createFetchClient } from '../fetch.server.ts';

export async function action({ request }: ActionFunctionArgs) {
  const fetchClient = createFetchClient('');
  const gqlResponse = await fetchClient('/graphql', {
    body: request.body,
    headers: request.headers,
    method: 'POST',
  });

  return gqlResponse;
}
