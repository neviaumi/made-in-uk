import {
  type ActionFunctionArgs,
  json,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import { useNavigate } from '@remix-run/react';
import { useEffect } from 'react';

import { APP_ENV, loadConfig } from '@/config.server.ts';
import { withErrorCode } from '@/error.server.ts';
import { createAPIFetchClient } from '@/fetch.server.ts';
import type { Logger } from '@/logger.server.ts';
import { createLogger } from '@/logger.server.ts';
import { useAuth } from '@/routes/auth/auth.hook.ts';
import { commitSession, getSession } from '@/routes/auth/sessions.server.ts';
import type { AuthLoaderResponse } from '@/routes/auth/types.ts';

type LoginSession = {
  expiresIn: number;
  sessionCookie: string;
};

async function initialLoginSession(
  request: Request,
  formData: FormData,
  { logger }: { logger: Logger },
): Promise<LoginSession> {
  const fetchClient = createAPIFetchClient();
  const requestId = String(request.headers.get('request-id'));
  const idToken = String(formData.get('id_token'));
  const { expires_in: expiresIn, session_cookie: token } = await fetchClient(
    '/auth/token',
    {
      body: (() => {
        const form = new FormData();
        form.append('id_token', idToken);
        form.append('grant_types', 'id_token');
        return form;
      })(),
      headers: {
        'request-id': requestId,
      },
      method: 'POST',
    },
  ).then(resp => {
    logger.info('Initial login session has been called', {
      resp: {
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText,
      },
    });
    if (resp.ok) return resp.json();
    throw withErrorCode('ERR_UNAUTHENTICATED')(new Error(resp.statusText));
  });
  return {
    expiresIn,
    sessionCookie: token,
  };
}

async function verifyLoginSession({ request }: { request: Request }): Promise<
  LoginSession & {
    shouldExtendSession: boolean;
  }
> {
  const session = await getSession(request.headers.get('Cookie'));
  if (!session.get('sessionCookie') || !session.get('expiresTime')) {
    throw withErrorCode('ERR_UNAUTHENTICATED')(new Error('Unauthorized'));
  }
  const currentToken = session.get('sessionCookie')!;
  const expiresTime = session.get('expiresTime')!;
  const timeLeft = expiresTime - Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;
  if (timeLeft >= FIVE_MINUTES) {
    return {
      expiresIn: timeLeft / 1000,
      sessionCookie: currentToken,
      shouldExtendSession: false,
    };
  }
  return {
    expiresIn: timeLeft / 1000,
    sessionCookie: currentToken,
    shouldExtendSession: true,
  };
}

async function exchangeTokenForExtendLoginSession(
  request: Request,
  { logger }: { logger: Logger },
): Promise<{
  customToken: string;
}> {
  // Generate token for exchange id token in order to reset session
  // https://stackoverflow.com/questions/53970700/how-to-extend-firebase-session-cookies-beyond-2-weeks
  const session = await getSession(request.headers.get('Cookie'));
  const requestId = String(request.headers.get('request-id'));

  const currentToken = session.get('sessionCookie');

  if (!currentToken) {
    logger.error('Missing session cookie');
    throw withErrorCode('ERR_UNAUTHENTICATED')(
      new Error('Missing session cookie'),
    );
  }

  const fetchClient = createAPIFetchClient();
  const data = await fetchClient('/auth/token', {
    body: (() => {
      const form = new FormData();
      form.append('grant_types', 'session_cookie');
      return form;
    })(),
    headers: {
      SessionCookie: currentToken,
      'request-id': requestId,
    },
    method: 'POST',
  }).then(resp => {
    logger.error('Exchange token for extend login session', {
      resp: {
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText,
      },
    });
    if (resp.ok) return resp.json();
    throw withErrorCode('ERR_UNAUTHENTICATED')(new Error(resp.statusText));
  });
  return {
    customToken: data.custom_token,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const config = loadConfig(APP_ENV);
  const logger = createLogger(APP_ENV);
  const requestId = request.headers.get('request-id') ?? crypto.randomUUID();

  const { isSignedIn, shouldExtendSession } = await verifyLoginSession({
    request,
  })
    .then(resp => {
      return {
        isSignedIn: true,
        shouldExtendSession: resp.shouldExtendSession,
      };
    })
    .catch(() => {
      return { isSignedIn: false, shouldExtendSession: false };
    });
  logger.info('Auth Loader has been called', {
    isSignedIn,
    shouldExtendSession,
  });

  return json<AuthLoaderResponse>({
    ENV: {
      FIREBASE_AUTH_EMULATOR_HOST: config.get('firebase.auth.emulatorHost')!,
      WEB_ENV: APP_ENV,
      WEB_FIREBASE_API_KEY: config.get('firebase.auth.apiKey')!,
    },
    isSignedIn,
    requestId,
    shouldExtendSession,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get('Cookie'));
  const inputFormData = await request.formData();
  const requestId = String(request.headers.get('request-id'));
  const responseType = String(inputFormData.get('response_type'));
  const logger = createLogger(APP_ENV).child({
    requestId,
    responseType,
  });
  logger.info('Auth Action has been called');

  if (responseType === 'session_cookie') {
    const { expiresIn, sessionCookie } = await initialLoginSession(
      request,
      inputFormData,
      { logger },
    );
    session.set('sessionCookie', sessionCookie);
    session.set('expiresTime', Date.now() + 1000 * expiresIn);

    return json(
      {},
      {
        headers: {
          'Set-Cookie': await commitSession(session, {
            maxAge: expiresIn,
          }),
        },
      },
    );
  }
  if (responseType === 'custom_token') {
    const { customToken } = await exchangeTokenForExtendLoginSession(request, {
      logger,
    });
    return json({ customToken: customToken });
  }
  throw withErrorCode('ERR_UNEXPECTED_ERROR')(
    new Error('Invalid response type'),
  );
}

export default function Auth() {
  const [{ isSignedIn, shouldExtendSession }] = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isSignedIn && !shouldExtendSession) {
      const redirectUri = new URL(
        new URLSearchParams(window.location.search).get('redirect_uri') ?? '/',
        window.location.origin,
      ).pathname;
      navigate(redirectUri);
    }
  }, [isSignedIn, shouldExtendSession]);
  return null;
}
