import type { Plugin } from 'graphql-yoga';

export function useAuth(): Plugin {
  return {
    async onRequest({ endResponse, fetchAPI, request }) {
      const requestUrl = new URL(request.url);
      if (
        requestUrl.pathname === '/auth/session' &&
        request.method === 'POST'
      ) {
        return endResponse(
          new fetchAPI.Response(
            JSON.stringify({
              id: crypto.randomUUID(),
            }),
            {
              headers: {
                'Content-Type': 'application/json',
              },
              status: 201,
            },
          ),
        );
      }
    },
  };
}
