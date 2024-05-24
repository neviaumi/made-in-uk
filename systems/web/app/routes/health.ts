import { json } from '@remix-run/node';

import { createFetchClient } from '../fetch.server.ts';

export async function loader() {
  const fetchClient = createFetchClient();
  const apiHealth = await fetchClient('health', {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'GET',
  })
    .then(async res => {
      if (!res.ok) {
        throw new Error(
          `Failed to fetch API health: ${res.status} ${res.statusText}`,
        );
      } else {
        return {
          status: 'ok',
        };
      }
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
