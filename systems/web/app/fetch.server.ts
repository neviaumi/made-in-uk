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
    if (webEnv !== 'development') {
      const authHeaders = await auth.getRequestHeaders(webApiHost);
      init.headers = Object.assign(
        Object.fromEntries(headerInitToEntries(init.headers)),
        authHeaders,
      );
    }
    return fetch(new URL(path, webApiHost).toString(), init);
  };
}
