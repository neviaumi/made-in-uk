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
    if (webEnv !== 'development') {
      const idTokenClient = await auth.getIdTokenClient(webApiHost);
      const authHeaders = await idTokenClient.getRequestHeaders(requestPath);
      init.headers = Object.assign(
        Object.fromEntries(headerInitToEntries(init.headers)),
        authHeaders,
      );
    }
    // eslint-disable-next-line no-console
    console.log({
      headers: init.headers,
      init,
      message: 'before fetch',
      requestPath,
    });
    return fetch(requestPath, init);
  };
}
