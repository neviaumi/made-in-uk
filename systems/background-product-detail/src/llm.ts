import { GoogleAuth } from 'google-auth-library';

import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import type { Logger } from '@/logger.ts';

const config = loadConfig(APP_ENV);

export async function extractCountryFromAddress(
  address: string,
  logger: Logger,
): Promise<{
  extractedCountry: string;
  withInUK: boolean;
}> {
  const llmEndpoint = config.get('llm.endpoint');
  if (!llmEndpoint) throw new Error('llm.endpoint is not defined');
  const requestInit: RequestInit = {
    body: JSON.stringify({
      prompt: `<|user|>
Extract country from given address and report do the country extracted within United Kingdom?
Generated response in JSON Object format with 2 key, 'extractedCountry' (string) and 'withInUK' (boolean)<|end|>
<|assistant|>
${address}<|end|>`,
      system:
        'You are AI system that able to extract country from address and understand the boundaries of Country.',
    }),
    method: 'POST',
  };
  const requestInitHeaders: Array<[string, string]> = [
    ['Content-Type', 'application/json'],
  ];
  if (![AppEnvironment.DEV, AppEnvironment.TEST].includes(APP_ENV)) {
    const auth = new GoogleAuth();
    const idTokenClient = await auth.getIdTokenClient(llmEndpoint);
    requestInit.headers = requestInitHeaders.concat(
      Object.entries(await idTokenClient.getRequestHeaders()),
    );
  }
  return await fetch(new URL('/prompt', llmEndpoint), requestInit)
    .then(res => res.json())
    .then(jsonRes => {
      return ((content: string) => {
        try {
          return JSON.parse(content);
        } catch {
          logger.error('Failed to parse JSON response from LLM', {
            generatedContent: content,
          });
          return {
            extractedCountry: 'Unknown',
            withInUK: false,
          };
        }
      })(jsonRes['message']);
    });
}
