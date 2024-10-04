import { createCookieSessionStorage } from '@remix-run/node'; // or cloudflare/deno

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
