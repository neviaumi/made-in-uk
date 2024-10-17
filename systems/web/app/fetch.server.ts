import { GoogleAuth } from 'google-auth-library';

import { APP_ENV, loadConfig } from '@/config.server.ts';
import { withErrorCode } from '@/error.ts';

function headerInitToEntries(init: HeadersInit | undefined) {
  if (!init) return [];
  if (Array.isArray(init)) return init;
  if (init instanceof Headers) return init.entries();
  return Object.entries(init);
}

export function createAPIFetchClient(): typeof fetch {
  const config = loadConfig(APP_ENV);

  const { webApiHost, webEnv } = {
    webApiHost: config.get('api.endpoint')!,
    webEnv: config.get('env')!,
  };

  return async (req: string | Request | URL, init?: RequestInit) => {
    if (!init)
      throw withErrorCode('ERR_UNEXPECTED_ERROR')(
        new Error('Unexpect usage of fetch, init is required'),
      );
    const requestPath = (() => {
      if (req instanceof URL)
        return new URL(req.pathname, webApiHost).toString();
      if (req instanceof Request)
        return new URL(new URL(req.url).pathname, webApiHost).toString();
      return new URL(req.toString(), webApiHost).toString();
    })();
    const initHeaders = Array.from(headerInitToEntries(init.headers)).filter(
      ([key]) => !['authorization', 'host'].includes(key.toLowerCase()),
    );
    let authHeaders = {};
    if (webEnv !== 'development') {
      const auth = new GoogleAuth();
      const idTokenClient = await auth.getIdTokenClient(webApiHost);
      authHeaders = await idTokenClient.getRequestHeaders(requestPath);
      init.headers = initHeaders.concat(Object.entries(authHeaders));
    } else {
      init.headers = initHeaders;
    }
    return fetch(requestPath, init);
  };
}
