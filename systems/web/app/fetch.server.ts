import { GoogleAuth } from 'google-auth-library';

import { APP_ENV, loadConfig } from '@/config.server.ts';

const config = loadConfig(APP_ENV);

function headerInitToEntries(init: HeadersInit | undefined) {
  if (!init) return [];
  if (Array.isArray(init)) return init;
  if (init instanceof Headers) return init.entries();
  return Object.entries(init);
}

export function createFetchClient() {
  const { webApiHost, webEnv } = {
    webApiHost: config.get('api.endpoint')!,
    webEnv: config.get('env')!,
  };
  const auth = new GoogleAuth();

  return async (path: string, init: RequestInit) => {
    const requestPath = new URL(path, webApiHost).toString();
    const initHeaders = Array.from(headerInitToEntries(init.headers)).filter(
      ([key]) => !['authorization', 'host'].includes(key.toLowerCase()),
    );
    let authHeaders = {};
    if (webEnv !== 'development') {
      const idTokenClient = await auth.getIdTokenClient(webApiHost);
      authHeaders = await idTokenClient.getRequestHeaders(requestPath);
      init.headers = initHeaders.concat(Object.entries(authHeaders));
    } else {
      init.headers = initHeaders;
    }
    return fetch(requestPath, init);
  };
}
