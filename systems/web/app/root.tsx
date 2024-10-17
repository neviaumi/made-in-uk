import '@/tailwind.css';

import type { LinksFunction } from '@remix-run/node';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';

import { cacheExchange, Client, fetchExchange, Provider } from '@/deps/urql.ts';

export const links: LinksFunction = () => [
  { as: 'image', href: '/icon.png', rel: 'preload' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const client = new Client({
    exchanges: [cacheExchange, fetchExchange],
    url: '/graphql',
  });

  return (
    <Provider value={client}>
      <Outlet />
    </Provider>
  );
}
