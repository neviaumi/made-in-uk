import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Plugin } from 'graphql-yoga';

const SESSION_EXPIRATION = 60 * 60 * 24 * 365 * 1000; // 1 year

function createAccessGrant(grantTypes: 'id_token' | 'session_cookie') {
  const firebaseApp = initializeApp();
  const auth = getAuth(firebaseApp);
  const grants = {
    idTokenGrant: async (request: Request): Promise<Response> => {
      const formData = await request.formData();
      const idToken = String(formData.get('id_token'));
      const { sub: userId } = await auth.verifyIdToken(idToken, true);
      const customToken = await auth.createCustomToken(userId);
      const sessionCookies = await auth.createSessionCookie(customToken, {
        expiresIn: SESSION_EXPIRATION,
      });
      return new Response(
        JSON.stringify({
          expires_in: SESSION_EXPIRATION / 1000,
          session_cookie: sessionCookies,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        },
      );
    },
    sessionCookieGrant: async (request: Request): Promise<Response> => {
      const currentSessionCookies = request.headers
        .get('Authorization')
        ?.split(' ')[1];
      if (!currentSessionCookies) {
        return new Response('Unauthorized', { status: 401 });
      }
      const { sub: userId } = await auth.verifySessionCookie(
        currentSessionCookies,
        true,
      );
      const customToken = await auth.createCustomToken(userId);
      const sessionCookies = await auth.createSessionCookie(customToken, {
        expiresIn: SESSION_EXPIRATION,
      });
      return new Response(
        JSON.stringify({
          expires_in: SESSION_EXPIRATION / 1000,
          session_cookie: sessionCookies,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        },
      );
    },
  };

  switch (grantTypes) {
    case 'id_token':
      return grants.idTokenGrant;
    case 'session_cookie':
      return grants.sessionCookieGrant;
    default:
      throw new Error('Invalid grant type');
  }
}

export function useAuth(): Plugin {
  return {
    async onRequest({ endResponse, request }) {
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname === '/auth/token' && request.method === 'POST') {
        const formData = await request.formData();
        const grantTypes = String(formData.get('grant_types')) as Parameters<
          typeof createAccessGrant
        >[0];
        return endResponse(await createAccessGrant(grantTypes)(request));
      }
    },
  };
}
