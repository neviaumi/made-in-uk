import { GoogleAuth } from 'google-auth-library';

function headerInitToEntries(init: HeadersInit | undefined) {
  if (!init) return [];
  if (Array.isArray(init)) return init;
  if (init instanceof Headers) return init.entries();
  return Object.entries(init);
}

export function createFetchClient() {
  const { webApiHost, webEnv } = {
    webApiHost: process.env['WEB_API_HOST']!,
    webEnv: process.env['WEB_ENV']!,
  };
  if (!webApiHost) throw new Error('webApiHost is not defined');
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
    // eslint-disable-next-line no-console
    console.log({
      authHeaders,
      initHeaders,
      mergeHeaders: init.headers,
      message: 'before fetch',
      requestPath,
    });
    return fetch(requestPath, init);
  };
}
