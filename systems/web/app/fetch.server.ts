import path from 'node:path';

import type { GaxiosOptions } from 'gaxios';
import { GoogleAuth } from 'google-auth-library';
import { find, isNil, mergeDeepLeft, not, pipe, prop } from 'ramda';

export function createFetchClient(preInput: string, preConfig?: RequestInit) {
  const { webApiHost, webEnv } = {
    webApiHost: process.env['WEB_API_HOST']!,
    webEnv: process.env['WEB_ENV']!,
  };
  if (!webApiHost) throw new Error('webApiHost is not defined');
  const auth = new GoogleAuth();

  return async (input: string, init: RequestInit) => {
    if (webEnv === 'development') {
      const requestInit: RequestInit = {
        ...preConfig,
        ...init,
      };
      return fetch(
        new URL(path.join(preInput, input), webApiHost).toString(),
        requestInit,
      );
    }
    const client = await auth.getIdTokenClient(webApiHost);
    const response = await client.request({
      body: init?.body,
      headers: mergeDeepLeft(preConfig?.headers ?? {}, init?.headers ?? {}),
      method: prop('method')(
        find(pipe(prop('method'), isNil, not))([
          preConfig ?? {},
          init,
          {
            method: 'GET',
          },
        ]) as { method: string },
      ) as GaxiosOptions['method'],
      responseType: 'json',
      url: new URL(path.join(preInput, input), webApiHost).toString(),
    });
    return Response.json(response.data, {
      status: response.status,
      statusText: response.statusText,
    });
  };
}
