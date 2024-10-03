import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Plugin } from 'graphql-yoga';

import { APP_ENV } from '@/config.ts';
import { createLogger } from '@/logger.ts';

const logger = createLogger(APP_ENV);
const SESSION_EXPIRATION = 60 * 60 * 24 * 7 * 1000; // 2 weeks

function createAccessGrant(grantTypes: 'id_token' | 'session_cookie') {
  const firebaseApp = initializeApp({});
  const auth = getAuth(firebaseApp);
  const grants: Record<
    'idTokenGrant' | 'sessionCookieGrant',
    (request: Request, bodyForm: FormData) => Promise<Response>
  > = {
    idTokenGrant: async (_: Request, formData: FormData): Promise<Response> => {
      const idToken = String(formData.get('id_token'));
      const { firebase, sub: userId } = await auth.verifyIdToken(idToken, true);
      logger.info("Decoded user's ID token", { firebase, userId });
      const sessionCookies = await auth.createSessionCookie(idToken, {
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

      return new Response(
        JSON.stringify({
          custom_token: customToken,
          expires_in: 3600,
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
      logger.info("Auth plugin's onRequest hook has been called");
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname === '/auth/token' && request.method === 'POST') {
        const formData = await request.formData();
        const grantTypes = String(formData.get('grant_types')) as Parameters<
          typeof createAccessGrant
        >[0];
        logger.info('/auth/token has been called with grant type', {
          grantTypes,
        });
        return endResponse(
          await createAccessGrant(grantTypes)(request, formData).catch(e => {
            logger.error(e.message, { error: e });
            return new Response(null, { status: 500 });
          }),
        );
      }
    },
  };
}
