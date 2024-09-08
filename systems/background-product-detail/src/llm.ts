import { GoogleAuth } from 'google-auth-library';

import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import type { Logger } from '@/logger.ts';

const config = loadConfig(APP_ENV);

function withTimeout(timeout: number) {
  return function wrapper<F extends (...args: any[]) => Promise<any>>(
    fn: F,
    defaultValue: Awaited<ReturnType<F>>,
  ): (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>> {
    return (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
      return Promise.race([
        new Promise<Awaited<ReturnType<F>>>(resolve =>
          setTimeout(() => resolve(defaultValue), timeout),
        ),
        fn(...args),
      ]);
    };
  };
}

async function _extractTotalWeight(
  input: { description: string },
  options: { logger: Logger },
): Promise<{
  data: {
    totalWeight: number | null;
    weightUnit: 'kg';
  };
  raw?: string;
}> {
  const logger = options.logger;
  const llmEndpoint = config.get('llm.endpoint');
  if (!llmEndpoint) throw new Error('llm.endpoint is not defined');
  const requestInit: RequestInit = {
    body: JSON.stringify({
      prompt: `<|user|>
Extract total weight from given product description, report what is total weight in kilogram?
Generated response in JSON Object format with 2 key, 'totalWeight' (number in kilogram unit, example value: 2, 4, 5,6 ...etc. ) and 'weightUnit' (string, only valid value should be kg.)<|end|>
<|assistant|>
${input.description}
The weight probably include the product name, please remove it before compute the price per unit.<|end|>`,
      system:
        'You are AI system that able to compute price per unit from given total price and capacity.',
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

  try {
    return await fetch(new URL('/prompt', llmEndpoint), requestInit)
      .then(res => res.json())
      .then(jsonRes => {
        return ((content: string) => {
          try {
            return { data: JSON.parse(content), raw: content };
          } catch {
            logger.error('Failed to parse JSON response from LLM', {
              generatedContent: content,
            });
            return {
              data: { totalWeight: null, weightUnit: 'kg' },
              raw: content,
            };
          }
        })(jsonRes['message']);
      });
  } catch {
    return { data: { totalWeight: null, weightUnit: 'kg' } };
  }
}

export const extractTotalWeight = withTimeout(1000 * 60 * 5)<
  typeof _extractTotalWeight
>(_extractTotalWeight, { data: { totalWeight: null, weightUnit: 'kg' } });

async function _extractCountryFromAddress(
  address: string,
  logger: Logger,
): Promise<{
  data: {
    extractedCountry: string;
    withInUK: boolean;
  };
  raw?: string;
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
  try {
    return await fetch(new URL('/prompt', llmEndpoint), requestInit)
      .then(res => res.json())
      .then(jsonRes => {
        return ((content: string) => {
          try {
            return { data: JSON.parse(content), raw: content };
          } catch {
            logger.error('Failed to parse JSON response from LLM', {
              generatedContent: content,
            });
            return {
              data: { extractedCountry: 'Unknown', withInUK: false },
              raw: content,
            };
          }
        })(jsonRes['message']);
      });
  } catch {
    return {
      data: { extractedCountry: 'Unknown', withInUK: false },
    };
  }
}

export const extractCountryFromAddress = withTimeout(1000 * 60 * 5)<
  typeof _extractCountryFromAddress
>(_extractCountryFromAddress, {
  data: { extractedCountry: 'Unknown', withInUK: false },
});
