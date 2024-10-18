import { type ActionFunctionArgs } from '@remix-run/node';

import {
  getCurrentSession,
  getSessionCookie,
} from '@/routes/auth/sessions.server.ts';

import { createAPIFetchClient } from '../fetch.server.ts';

export async function action({ request }: ActionFunctionArgs) {
  const sessionCookie = getSessionCookie(await getCurrentSession({ request }));
  if (!sessionCookie) {
    return new Response('Unauthorized', { status: 401 });
  }
  request.headers.set('SessionCookie', sessionCookie);
  const fetchClient = createAPIFetchClient();
  const gqlResponse = await fetchClient('/graphql', {
    body: request.body,
    duplex: 'half',
    // headers: {
    //   SessionCookie: session.get('sessionCookie'),
    //   ...request.headers,
    // },
    headers: request.headers,
    method: 'POST',
  });

  return gqlResponse;
}
