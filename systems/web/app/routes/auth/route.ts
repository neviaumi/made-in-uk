import {
  type ActionFunctionArgs,
  json,
  type LoaderFunctionArgs,
} from '@remix-run/node';

import { APP_ENV, loadConfig } from '@/config.server.ts';
import { createLogger } from '@/logger.server.ts';
import {
  initialLoginSession,
  verifyLoginSession,
} from '@/routes/auth/auth.server.ts';
import { commitSession, getSession } from '@/sessions.server.ts';

export async function loader({ request }: LoaderFunctionArgs) {
  const config = loadConfig(APP_ENV);
  const logger = createLogger(APP_ENV);

  logger.info('Auth Loader has been called');

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
  const logger = createLogger(APP_ENV);
  logger.info('Auth Action has been called');
  const session = await getSession(request.headers.get('Cookie'));
  const { expiresIn, sessionCookie } = await initialLoginSession({ request });
  session.set('sessionCookie', sessionCookie);
  session.set('expiresTime', Date.now() + 1000 * expiresIn);
  logger.info('Login session has been set', {
    expiresIn,
    sessionCookie,
  });

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
