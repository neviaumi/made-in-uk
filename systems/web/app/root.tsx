import { cssBundleHref } from '@remix-run/css-bundle';
import {
  type ActionFunctionArgs,
  json,
  type LinksFunction,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import {
  Links,
  LiveReload,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from '@remix-run/react';
import { cacheExchange, Client, fetchExchange, Provider } from 'urql';

import { useAuth } from '@/auth.client.ts';
import { initialLoginSession, verifyLoginSession } from '@/auth.server.ts';
import { APP_ENV, type AppEnvironment, loadConfig } from '@/config.server.ts';
import { commitSession, getSession } from '@/sessions.server.ts';

import styles from './tailwind.css';

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ href: cssBundleHref, rel: 'stylesheet' }] : []),
  { href: styles, rel: 'stylesheet' },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const config = loadConfig(APP_ENV);
  const { isSignedIn } = await verifyLoginSession({ request })
    .then(() => {
      return { isSignedIn: true };
    })
    .catch(() => {
      return { isSignedIn: false };
    });
  return json({
    ENV: {
      FIREBASE_AUTH_EMULATOR_HOST: config.get('firebase.auth.emulatorHost'),
      WEB_ENV: APP_ENV,
    },
    isSignedIn,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const { expiresIn, sessionCookie } = await initialLoginSession({ request });
  session.set('sessionCookie', sessionCookie);
  session.set('expiresTime', Date.now() + 1000 * expiresIn);
  return json(
    { sessionCookie },
    {
      headers: {
        'Set-Cookie': await commitSession(session, {
          maxAge: expiresIn,
        }),
      },
    },
  );
}

export default function App() {
  const client = new Client({
    exchanges: [cacheExchange, fetchExchange],
    url: '/graphql',
  });
  const {
    ENV: { FIREBASE_AUTH_EMULATOR_HOST, WEB_ENV },
    isSignedIn,
  } = useLoaderData<{
    ENV: { FIREBASE_AUTH_EMULATOR_HOST: string; WEB_ENV: AppEnvironment };
    isSignedIn: boolean;
  }>();
  useAuth({
    env: WEB_ENV,
    firebaseAuthEmulatorHost: FIREBASE_AUTH_EMULATOR_HOST,
    isSignedIn,
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
