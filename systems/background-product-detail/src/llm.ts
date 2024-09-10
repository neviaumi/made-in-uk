import { GoogleAuth } from 'google-auth-library';
import { Agent, fetch, type RequestInit } from 'undici';

import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import type { Logger } from '@/logger.ts';

const config = loadConfig(APP_ENV);
const DEFAULT_LLM_TIMEOUT =
  APP_ENV === AppEnvironment.DEV ? 1000 * 60 * 10 : 1000 * 60 * 5;

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
  options: { logger: Logger; requestId: string },
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
Generated response in JSON Object format with 2 key, 'totalWeight' (floating number in kilogram unit, example value: 2, 4, 5,6, 0.5, 0.46 ...etc. ) and 'weightUnit' (string, only valid value should be kg.)
Given Input: Tuna with Salmon Shredded Fillets (24 x 70g)<|end|>
<|assistant|>${JSON.stringify({ totalWeight: 1.68, weightUnit: 'kg' })}
Explanation:
total weight of Tuna with Salmon Shredded Fillets (24 x 70g) is 1.68kg because 24 x 70g = 1680g = 1.68kg<|end|>
<|user|>Given Input: Shredded Fillets 8 x 70g Multipack<|end|>
<|assistant|>${JSON.stringify({ totalWeight: 0.56, weightUnit: 'kg' })}
Explanation:
total weight of Shredded Fillets 8 x 70g Multipack is 0.56kg because 8 x 70g = 560g = 0.56kg<|end|>
<|user|>Given Input: Chicken with Veggies Dry Food (4kg)<|end|>
<|assistant|>${JSON.stringify({ totalWeight: 4, weightUnit: 'kg' })}
Explanation:
total weight of Chicken with Veggies Dry Food (4kg) is 4kg because 4kg = 4kg<|end|>
<|user|>Given Input: White Fish & Salmon Dry Food (2kg)<|end|>
<|assistant|>${JSON.stringify({ totalWeight: 2, weightUnit: 'kg' })}
Explanation:
total weight of White Fish & Salmon Dry Food (2kg) is 2kg because 2kg = 2kg<|end|>
<|user|>Given Input: ${input.description}<|end|>`,
      system:
        'You are AI system that able to extract total weight from given input .',
    }),
    dispatcher: new Agent({
      bodyTimeout: DEFAULT_LLM_TIMEOUT,
      headersTimeout: DEFAULT_LLM_TIMEOUT,
    }),
    method: 'POST',
  };
  const requestInitHeaders: Array<[string, string]> = [
    ['Content-Type', 'application/json'],
    ['request-id', options.requestId],
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
        })((jsonRes as { message: string })['message']);
      });
  } catch (e) {
    return { data: { totalWeight: null, weightUnit: 'kg' } };
  }
}

export const extractTotalWeight = withTimeout(DEFAULT_LLM_TIMEOUT)<
  typeof _extractTotalWeight
>(_extractTotalWeight, { data: { totalWeight: null, weightUnit: 'kg' } });

async function _extractCountryFromAddress(
  address: string,
  options: { logger: Logger; requestId: string },
): Promise<{
  data: {
    extractedCountry: string;
    withInUK: boolean;
  };
  raw?: string;
}> {
  const { logger, requestId } = options;
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
    ['request-id', requestId],
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
        })((jsonRes as { message: string })['message']);
      });
  } catch {
    return {
      data: { extractedCountry: 'Unknown', withInUK: false },
    };
  }
}

export const extractCountryFromAddress = withTimeout(DEFAULT_LLM_TIMEOUT)<
  typeof _extractCountryFromAddress
>(_extractCountryFromAddress, {
  data: { extractedCountry: 'Unknown', withInUK: false },
});
