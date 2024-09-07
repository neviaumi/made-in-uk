import { cssBundleHref } from '@remix-run/css-bundle';
import type { LinksFunction } from '@remix-run/node';
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

import styles from './tailwind.css';

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ href: cssBundleHref, rel: 'stylesheet' }] : []),
  { href: styles, rel: 'stylesheet' },
];

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
