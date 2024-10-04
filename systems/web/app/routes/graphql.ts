import { type ActionFunctionArgs } from '@remix-run/node';

import { getSession } from '@/routes/auth/sessions.server.ts';

import { createAPIFetchClient } from '../fetch.server.ts';

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  if (!session.get('sessionCookie')) {
    return new Response('Unauthorized', { status: 401 });
  }
  request.headers.set('SessionCookie', session.get('sessionCookie')!);
  const fetchClient = createAPIFetchClient();
  const gqlResponse = await fetchClient('/graphql', {
    body: request.body,
    // headers: {
    //   SessionCookie: session.get('sessionCookie'),
    //   ...request.headers,
    // },
    headers: request.headers,
    method: 'POST',
  });

  return gqlResponse;
}
