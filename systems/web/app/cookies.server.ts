import { createCookie } from '@remix-run/node';

export const userSession = createCookie('user-session', {
  httpOnly: true,
  maxAge: undefined, // value should be set by the server
  path: '/', // apply to all routes
  sameSite: 'strict',
  secure: true,
});
