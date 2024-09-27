import { createCookie } from '@remix-run/node';

// import { APP_ENV, AppEnvironment } from '@/config.server.ts';

// const shouldUseSecureCookie = ![
//   AppEnvironment.DEV,
//   AppEnvironment.TEST,
// ].includes(APP_ENV);

const shouldUseSecureCookie = true;
export const userSession = createCookie('user-session', {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: '/', // apply to all routes
  sameSite: 'strict',
  secure: shouldUseSecureCookie,
});
