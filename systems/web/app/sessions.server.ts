import { createCookieSessionStorage } from '@remix-run/node'; // or cloudflare/deno

type SessionData = {
  expiresTime: number;
  sessionCookie: string;
};

type SessionFlashData = {
  error: string;
};

const { commitSession, destroySession, getSession } =
  createCookieSessionStorage<SessionData, SessionFlashData>({
    // a Cookie from `createCookie` or the CookieOptions to create one
    cookie: {
      httpOnly: true,
      maxAge: undefined, // value should be set by the server
      path: '/', // apply to all routes
      sameSite: 'strict',
      secure: true,
    },
  });

export { commitSession, destroySession, getSession };
