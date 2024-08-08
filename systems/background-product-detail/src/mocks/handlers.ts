import { http, HttpResponse } from 'msw';

import { AppEnvironment, loadConfig } from '@/config.ts';

const config = loadConfig(AppEnvironment.TEST);

export const handlers = [
  http.post(new URL('/prompt', config.get('llm.endpoint')!).toString(), () => {
    // ...and respond to them using this JSON response.
    return HttpResponse.json({
      message: JSON.stringify({
        extractedCountry: 'United Kingdom',
        withInUK: true,
      }),
    });
  }),
];
