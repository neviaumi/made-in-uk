import { cssBundleHref } from '@remix-run/css-bundle';
import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';
import {
  Links,
  LiveReload,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import { cacheExchange, Client, fetchExchange, Provider } from 'urql';

import { APP_ENV } from '@/config.server.ts';
import { userSession } from '@/cookies.server.ts';
import { createAPIFetchClient } from '@/fetch.server.ts';
import { createLogger } from '@/logger.server.ts';

import styles from './tailwind.css';

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ href: cssBundleHref, rel: 'stylesheet' }] : []),
  { href: styles, rel: 'stylesheet' },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const logger = createLogger(APP_ENV);
  const session = await userSession.parse(request.headers.get('Cookie'));
  if (!session) {
    const apiClient = createAPIFetchClient();
    const { id: newSessionId } = await apiClient('/auth/session', {
      method: 'POST',
    }).then(resp => resp.json());
    logger.info('Register session', { session: newSessionId });
    return new Response(null, {
      headers: {
        'Set-Cookie': await userSession.serialize(newSessionId),
      },
    });
  }
  logger.info('Session already exist', { session });
  return null;
}

export default function App() {
  const client = new Client({
    exchanges: [cacheExchange, fetchExchange],
    url: '/graphql',
  });
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <Meta />
        <Links />
      </head>
      <body>
        <nav className={'tw-container tw-mx-auto'}>
          <ol className={'tw-flex tw-flex-row tw-gap-0.5 tw-py-1'}>
            <li>
              <NavLink
                className={({ isActive }) => {
                  const classes = [
                    'tw-block tw-px-2 tw-py-1 tw-rounded-xl hover:tw-outline hover:tw-outline-1 hover:tw-outline-emerald-300',
                  ];
                  if (isActive) classes.push('tw-bg-primary tw-font-semibold');
                  return classes.join(' ');
                }}
                to={'/'}
              >
                Mall
              </NavLink>
            </li>
            <li>
              <NavLink
                className={({ isActive }) => {
                  const classes = [
                    'tw-block tw-px-2 tw-py-1 tw-rounded-xl hover:tw-outline hover:tw-outline-1 hover:tw-outline-emerald-300',
                  ];
                  if (isActive) classes.push('tw-bg-primary tw-font-semibold');
                  return classes.join(' ');
                }}
                to={'/deal-monitor'}
              >
                Deal Monitors
              </NavLink>
            </li>
          </ol>
        </nav>
        <Provider value={client}>
          <Outlet />
        </Provider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
