import { json } from '@remix-run/node';

import { createFetchClient } from '../fetch.server.ts';

export async function loader() {
  const fetchClient = createFetchClient();
  const apiHealth = await fetchClient('health', {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'GET',
  }).then(async res => {
    if (!res.ok) {
      return res.json().catch(e => ({
        error: e.message,
        status: 'error',
      }));
    }
    return {
      status: 'ok',
    };
  });
  return json(apiHealth);
}
