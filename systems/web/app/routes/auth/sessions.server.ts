import { createCookieSessionStorage, redirect } from '@remix-run/node'; // or cloudflare/deno

import { APP_ENV, loadConfig } from '@/config.server.ts';

type SessionData = {
  expiresTime: number;
  sessionCookie: string;
};

type SessionFlashData = {
  error: string;
};

const config = loadConfig(APP_ENV);

const { commitSession, destroySession, getSession } =
  createCookieSessionStorage<SessionData, SessionFlashData>({
    // a Cookie from `createCookie` or the CookieOptions to create one
    cookie: {
      httpOnly: true,
      maxAge: undefined, // value should be set by the server
      path: '/', // apply to all routes
      sameSite: 'strict',
      secrets: [config.get('auth.secret')!],
      secure: true,
    },
  });

export { commitSession, destroySession, getSession };

export async function isAuthSessionExist({ request }: { request: Request }) {
  const session = await getSession(request.headers.get('Cookie'));
  return !(!session.get('sessionCookie') || !session.get('expiresTime'));
}

export function redirectToAuthPage({ request }: { request: Request }) {
  const currentUrl = new URL(request.url);
  const redirectUrl = new URL('/login', currentUrl.origin);
  redirectUrl.searchParams.set(
    'redirect_url',
    `${currentUrl.pathname}${currentUrl.search}`,
  );
  return redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
}

export function getCurrentSession({ request }: { request: Request }) {
  return getSession(request.headers.get('Cookie')).then(
    session => session.get('sessionCookie')!,
  );
}
