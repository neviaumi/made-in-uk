import { type ActionFunctionArgs } from '@remix-run/node';

import { createAPIFetchClient } from '../fetch.server.ts';

export async function action({ request }: ActionFunctionArgs) {
  const fetchClient = createAPIFetchClient();
  const gqlResponse = await fetchClient('/graphql', {
    body: request.body,
    headers: request.headers,
    method: 'POST',
  });

  return gqlResponse;
}
