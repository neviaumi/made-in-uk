import {
  type ActionFunctionArgs,
  json,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import { useNavigate } from '@remix-run/react';
import { useEffect } from 'react';

import { APP_ENV, loadConfig } from '@/config.server.ts';
import { isNativeError, withErrorCode } from '@/error.server.ts';
import { createAPIFetchClient } from '@/fetch.server.ts';
import type { Logger } from '@/logger.server.ts';
import { createLogger } from '@/logger.server.ts';
import { useAuth } from '@/routes/auth/auth.hook.ts';
import {
  commitSession,
  destroySession,
  getCurrentSession,
  getSessionCookie,
  getSessionExpiresTime,
  isAuthSessionExist,
  setSessionCookie,
  setSessionExpiresTime,
} from '@/routes/auth/sessions.server.ts';
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

async function verifyLoginSession({
  request,
  requestId,
}: {
  request: Request;
  requestId: string;
}): Promise<
  LoginSession & {
    shouldExtendSession: boolean;
  }
> {
  if (!(await isAuthSessionExist({ request }))) {
    throw withErrorCode('ERR_UNAUTHENTICATED')(new Error('Unauthorized'));
  }
  const fetchClient = createAPIFetchClient();
  const session = await getCurrentSession({ request });
  const currentToken = getSessionCookie(session);
  const expiresTime = getSessionExpiresTime(session);
  const timeLeft = expiresTime - Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;
  const tokenInfo: { active: boolean } = await fetchClient('/auth/token_info', {
    body: (() => {
      const form = new FormData();
      form.set('sessionCookie', currentToken);
      return form;
    })(),
    headers: {
      'request-id': requestId,
    },
    method: 'POST',
  }).then(resp => {
    if (!resp.ok) {
      throw withErrorCode('ERR_REVOKED_SESSION')(new Error(resp.statusText));
    }
    return resp.json();
  });
  if (!tokenInfo.active) {
    throw withErrorCode('ERR_REVOKED_SESSION')(new Error('Revoked session'));
  }

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
  const session = await getCurrentSession({ request });
  const requestId = String(request.headers.get('request-id'));

  const currentToken = getSessionCookie(session);

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

  const { isSignedIn, shouldExtendSession, shouldRevokeSession } =
    await verifyLoginSession({
      request,
      requestId,
    })
      .then(resp => {
        return {
          isSignedIn: true,
          shouldExtendSession: resp.shouldExtendSession,
          shouldRevokeSession: false,
        };
      })
      .catch(e => {
        logger.error('verifyLoginSession failed', { error: e });
        if (isNativeError(e)) {
          if (e.code === 'ERR_REVOKED_SESSION') {
            return {
              isSignedIn: false,
              shouldExtendSession: false,
              shouldRevokeSession: true,
            };
          }
          return {
            isSignedIn: false,
            shouldExtendSession: false,
            shouldRevokeSession: false,
          };
        }
        return {
          isSignedIn: false,
          shouldExtendSession: false,
          shouldRevokeSession: false,
        };
      });
  logger.info('Auth Loader has been called', {
    response: { isSignedIn, shouldExtendSession, shouldRevokeSession },
  });

  return json<AuthLoaderResponse>(
    {
      ENV: {
        FIREBASE_AUTH_EMULATOR_HOST: config.get('firebase.auth.emulatorHost')!,
        WEB_ENV: APP_ENV,
        WEB_FIREBASE_API_KEY: config.get('firebase.auth.apiKey')!,
      },
      isSignedIn,
      requestId,
      shouldExtendSession,
    },
    {
      headers: shouldRevokeSession
        ? {
            'Set-Cookie': await destroySession(
              await getCurrentSession({ request }),
            ),
          }
        : {},
    },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getCurrentSession({ request });
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
    setSessionCookie(session, sessionCookie);
    setSessionExpiresTime(session, Date.now() + 1000 * expiresIn);

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
