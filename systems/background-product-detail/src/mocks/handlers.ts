import { http, HttpResponse } from 'msw';

import { AppEnvironment, loadConfig } from '@/config.ts';

const config = loadConfig(AppEnvironment.TEST);

export function createLLMPromptHandler(
  handler: Parameters<typeof http.post>[1],
) {
  return http.post(
    new URL('/prompt', config.get('llm.endpoint')!).toString(),
    handler,
  );
}

const NOT_IMPLEMENTED = () => {
  return HttpResponse.text('501 Not Implemented', {
    status: 501,
  });
};
export const handlers = [createLLMPromptHandler(NOT_IMPLEMENTED)];
