import { withErrorCode } from '@/error.server.ts';
import { createAPIFetchClient } from '@/fetch.server.ts';
import { getSession } from '@/sessions.server.ts';

type LoginSession = {
  expiresIn: number;
  sessionCookie: string;
};

export async function initialLoginSession({
  request,
}: {
  request: Request;
}): Promise<LoginSession> {
  const session = await getSession(request.headers.get('Cookie'));
  if (!session.get('sessionCookie') || !session.get('expiresTime')) {
    const fetchClient = createAPIFetchClient();
    const idToken = (await request.formData()).get('id_token')!;
    const { expires_in: expiresIn, session_cookie: token } = await fetchClient(
      '/auth/token',
      {
        body: (() => {
          const form = new FormData();
          form.append('id_token', idToken);
          form.append('grant_types', 'id_token');
          return form;
        })(),
        method: 'POST',
      },
    ).then(resp => {
      if (resp.ok) return resp.json();
      throw withErrorCode('ERR_UNAUTHENTICATED')(new Error(resp.statusText));
    });
    return {
      expiresIn,
      sessionCookie: token,
    };
  }
  const expiresTime = session.get('expiresTime')!;
  const timeLeft = expiresTime - Date.now();
  return {
    expiresIn: timeLeft / 1000,
    sessionCookie: session.get('sessionCookie')!,
  };
}

export async function verifyLoginSession({
  request,
}: {
  request: Request;
}): Promise<
  LoginSession & {
    shouldExtendSession: boolean;
  }
> {
  const session = await getSession(request.headers.get('Cookie'));
  if (!session.has('sessionCookie') || !session.has('expiresTime')) {
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

export async function extendLoginSession({
  request,
}: {
  request: Request;
}): Promise<LoginSession> {
  const session = await getSession(request.headers.get('Cookie'));
  const currentToken = session.get('sessionCookie')!;

  const fetchClient = createAPIFetchClient();
  const { expires_in: expiresIn, session_cookie: token } = await fetchClient(
    '/auth/token',
    {
      body: (() => {
        const form = new FormData();
        form.append('grant_types', 'session_cookie');
        return form;
      })(),
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
      method: 'POST',
    },
  )
    .then(resp => resp.json())
    .catch(e => withErrorCode('ERR_UNAUTHENTICATED')(e));
  return {
    expiresIn,
    sessionCookie: token,
  };
}

// export function serializeLoginSession({ request }: { request: Request }) {
//   const session = await getSession(request.headers.get('Cookie'));
//
//   return (loginSession: LoginSession) => {
//     const expiresTime = Date.now() + loginSession.expiresIn * 1000;
//     session.set('token', loginSession.session);
//     session.set('expiresTime', expiresTime);
//     return commitSession(session);
//
//   };
// }
