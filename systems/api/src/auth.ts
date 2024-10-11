import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createGraphQLError, type Plugin } from 'graphql-yoga';

import { APP_ENV } from '@/config.ts';
import { withErrorCode } from '@/error.ts';
import { createLogger, type Logger } from '@/logger.ts';

const SESSION_EXPIRATION = 60 * 60 * 24 * 7 * 1000; // 2 weeks
const firebaseApp = initializeApp({});

function createAccessGrant(
  grantTypes: 'id_token' | 'session_cookie',
  options: { logger: Logger },
) {
  const logger = options.logger;
  const auth = getAuth(firebaseApp);
  const grants: Record<
    'idTokenGrant' | 'sessionCookieGrant',
    (request: Request, bodyForm: FormData) => Promise<Response>
  > = {
    idTokenGrant: async (_: Request, formData: FormData): Promise<Response> => {
      logger.info('idTokenGrant has been called');
      const idToken = String(formData.get('id_token'));

      await auth.verifyIdToken(idToken, true);
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
      logger.info('sessionCookieGrant has been called');
      const currentSessionCookies = request.headers.get('SessionCookie');
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

export function useAuth(): Plugin<{ userId: string }> {
  return {
    async onContextBuilding({ breakContextBuilding, context, extendContext }) {
      const request = context.request;
      const givenSessionCookies = request.headers.get('SessionCookie');

      if (!givenSessionCookies) {
        breakContextBuilding();
        throw withErrorCode('ERR_UNAUTHENTICATED')(
          createGraphQLError('Missing header'),
        );
      }
      const auth = getAuth(firebaseApp);
      const { sub: userId } = await auth
        .verifySessionCookie(givenSessionCookies)
        .catch(e => {
          throw withErrorCode('ERR_UNAUTHENTICATED')(
            createGraphQLError("Can't verify session cookie", {
              originalError: e,
            }),
          );
        });
      extendContext({ userId });
      // Return the after stage handling
      return;
    },

    async onRequest({ endResponse, request }) {
      const requestUrl = new URL(request.url);
      if (
        requestUrl.pathname === '/auth/token_info' &&
        request.method === 'POST'
      ) {
        const requestId = String(request.headers.get('request-id'));
        const logger = createLogger(APP_ENV).child({ requestId });

        const formData = await request.formData();
        const currentSessionCookies = String(formData.get('sessionCookie'));
        const auth = getAuth(firebaseApp);
        const resp = await auth
          .verifySessionCookie(currentSessionCookies, true)
          .then(resp => Object.assign(resp, { active: true }))
          .catch(e => {
            logger.error('Session cookie is invalid', { e });
            return {
              active: false,
            };
          });
        return endResponse(new Response(JSON.stringify(resp), { status: 200 }));
      }
      if (requestUrl.pathname === '/auth/token' && request.method === 'POST') {
        const requestId = String(request.headers.get('request-id'));

        const formData = await request.formData();
        const grantTypes = String(formData.get('grant_types')) as Parameters<
          typeof createAccessGrant
        >[0];
        const logger = createLogger(APP_ENV).child({ grantTypes, requestId });

        try {
          const accessGrant = createAccessGrant(grantTypes, {
            logger,
          });
          logger.info('/auth/token has been called with grant type', {
            grantTypes,
          });
          return endResponse(
            await accessGrant(request, formData).catch(e => {
              logger.error(e.message, { error: e });
              return new Response(null, { status: 500 });
            }),
          );
        } catch (e) {
          logger.error('Something is wrong on server side!', { e, grantTypes });
          return endResponse(new Response(null, { status: 500 }));
        }
      }
    },
  };
}
