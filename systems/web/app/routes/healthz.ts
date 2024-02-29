import { json } from '@remix-run/node';

import { createFetchClient } from '../fetch.server.ts';

export async function loader() {
  const fetchClient = createFetchClient('');
  const apiHealth = await fetchClient('healthz', {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'GET',
  })
    .then(async res => {
      return res.json();
    })
    .catch(err => ({
      details: {
        api: {
          status: 'down',
        },
      },
      error: {
        api: err,
      },
      info: {
        api: {
          status: 'down',
        },
      },
      status: 'error',
    }));
  return json(apiHealth);
}
