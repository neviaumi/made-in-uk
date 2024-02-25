import path from 'node:path';

import type { GaxiosOptions } from 'gaxios';
import { GoogleAuth } from 'google-auth-library';
import { find, isNil, mergeDeepLeft, not, pipe, prop } from 'ramda';

export function createFetchClient(preInput: string, preConfig?: RequestInit) {
  const { webApiHost } = { webApiHost: process.env['WEB_API_HOST']! };
  if (!webApiHost) throw new Error('webApiHost is not defined');
  const auth = new GoogleAuth();

  return async (input: string, init: RequestInit) => {
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
    return Promise.resolve({ json: () => response.data });
  };
}
