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

export { commitSession, destroySession };

export async function isAuthSessionExist({ request }: { request: Request }) {
  const session = await getSession(request.headers.get('Cookie'));
  return !(!session.get('sessionCookie') || !session.get('expiresTime'));
}

export function redirectToAuthPage({ request }: { request: Request }) {
  const currentUrl = new URL(request.url);
  const redirectUrl = new URL('/auth', currentUrl.origin);
  redirectUrl.searchParams.set(
    'redirect_uri',
    `${currentUrl.pathname}${currentUrl.search}`,
  );
  return redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
}

export function getCurrentSession({ request }: { request: Request }) {
  return getSession(request.headers.get('Cookie'));
}

export function getSessionCookie(
  session: Awaited<ReturnType<typeof getSession>>,
) {
  return session.get('sessionCookie')!;
}

export function getSessionExpiresTime(
  session: Awaited<ReturnType<typeof getSession>>,
) {
  return session.get('expiresTime')!;
}

export function setSessionCookie(
  session: Awaited<ReturnType<typeof getSession>>,
  sessionCookie: string,
) {
  session.set('sessionCookie', sessionCookie);
}

export function setSessionExpiresTime(
  session: Awaited<ReturnType<typeof getSession>>,
  expiresTime: number,
) {
  session.set('expiresTime', expiresTime);
}
