import type { Logger } from '@/logger.ts';

import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import { GoogleAuth } from 'google-auth-library';

const config = loadConfig(APP_ENV);
const DEFAULT_LLM_TIMEOUT = 1000 * 60 * 5;

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

function shapeOfPrompts(
  prompts: Array<{ content: string; role: 'assistant' | 'system' | 'user' }>,
) {
  return prompts;
}

function shapeOfRequestBody(body: {
  prompts: ReturnType<typeof shapeOfPrompts>;
  response: {
    json_schema: {
      properties: Record<string, { type: string }>;
      required: string[];
      type: string;
    };
  };
}) {
  return JSON.stringify(body);
}

function createFetchLLMClient({ reqeustId }: { reqeustId: string }) {
  const llmEndpoint = config.get('llm.endpoint');
  if (!llmEndpoint) throw new Error('llm.endpoint is not defined');
  return async (requestInit: RequestInit) => {
    const requestInitHeaders: Array<[string, string]> = [
      ['Content-Type', 'application/json'],
      ['request-id', reqeustId],
    ];
    if (![AppEnvironment.DEV, AppEnvironment.TEST].includes(APP_ENV)) {
      const auth = new GoogleAuth();
      const idTokenClient = await auth.getIdTokenClient(llmEndpoint);
      requestInit.headers = requestInitHeaders.concat(
        Object.entries(await idTokenClient.getRequestHeaders()),
      );
    } else {
      requestInit.headers = requestInitHeaders;
    }
    return await fetch(new URL('/prompt', llmEndpoint), requestInit);
  };
}

async function _extractTotalWeight(
  input: { description: string },
  options: { logger: Logger; requestId: string },
): Promise<{
  data: {
    totalWeight: null | number;
    weightUnit: 'kg';
  };
  raw?: string;
}> {
  const logger = options.logger;
  const llmEndpoint = config.get('llm.endpoint');
  if (!llmEndpoint) throw new Error('llm.endpoint is not defined');
  const requestInit: RequestInit = {
    body: shapeOfRequestBody({
      prompts: shapeOfPrompts([
        {
          content:
            'You are AI system that able to extract total weight from given input .',
          role: 'system',
        },
        {
          content: `Extract total weight from given product description, report what is total weight in kilogram?
Generated response in JSON Object format with 2 key, 'totalWeight' (floating number in kilogram unit, example value: 2, 4, 5,6, 0.5, 0.46 ...etc. ) and 'weightUnit' (string, only valid value should be kg.)
Given Input: Tuna with Salmon Shredded Fillets (24 x 70g)`,
          role: 'user',
        },
        {
          content: `${JSON.stringify({ totalWeight: 1.68, weightUnit: 'kg' })}
Explanation:
total weight of Tuna with Salmon Shredded Fillets (24 x 70g) is 1.68kg because 24 x 70g = 1680g = 1.68kg`,
          role: 'assistant',
        },
        {
          content: 'Given Input: Shredded Fillets 8 x 70g Multipack',
          role: 'user',
        },
        {
          content: `${JSON.stringify({ totalWeight: 0.56, weightUnit: 'kg' })}
Explanation:
total weight of Shredded Fillets 8 x 70g Multipack is 0.56kg because 8 x 70g = 560g = 0.56kg`,
          role: 'assistant',
        },
        {
          content: `Given Input: Chicken with Veggies Dry Food (4kg)`,
          role: 'user',
        },
        {
          content: `${JSON.stringify({ totalWeight: 4, weightUnit: 'kg' })}
Explanation:
total weight of Chicken with Veggies Dry Food (4kg) is 4kg because 4kg = 4kg`,
          role: 'assistant',
        },
        {
          content: 'Given Input: White Fish & Salmon Dry Food (2kg)',
          role: 'user',
        },
        {
          content: `${JSON.stringify({ totalWeight: 2, weightUnit: 'kg' })}
Explanation:
total weight of White Fish & Salmon Dry Food (2kg) is 2kg because 2kg = 2kg`,
          role: 'assistant',
        },
        {
          content:
            'Given Input: Encore Natural Wet Cat Food Tins Fish Selection Broth - 12 x 70g',
          role: 'user',
        },
        {
          content: `${JSON.stringify({ totalWeight: 0.84, weightUnit: 'kg' })}
Explanation:
total weight of Encore Natural Wet Cat Food Tins Fish Selection Broth - 12 x 70g is 0.84kg because 12 * 70g = 840g = 0.84kg`,
          role: 'assistant',
        },
        {
          content: 'Applaws Tuna Fillet Wet Cat Food Tins - 24 x 70g',
          role: 'user',
        },
        {
          content: `${JSON.stringify({ totalWeight: 1.68, weightUnit: 'kg' })}
Explanation:
total weight of Applaws Tuna Fillet Wet Cat Food Tins - 24 x 70g is 1.68kg because 24 * 70g = 1680g = 1.68kg`,
          role: 'assistant',
        },
        {
          content:
            'Given Input: Catit Cuisine Tuna Pâté with Sardines Wet Cat Food - 12 x 95g',
          role: 'user',
        },
        {
          content: `${JSON.stringify({ totalWeight: 1.14, weightUnit: 'kg' })}
Explanation:
total weight of Catit Cuisine Tuna Pâté with Sardines Wet Cat Food - 12 x 95g is 1.14kg because 12 * 95g = 1140g = 1.14kg`,
          role: 'assistant',
        },
        {
          content:
            'Given Input: Encore Natural Wet Cat Food Tins Tuna Fillet in Broth - 16 x 70g',
          role: 'user',
        },
        {
          content: `${JSON.stringify({ totalWeight: 1.12, weightUnit: 'kg' })}
Explanation:
total weight of Encore Natural Wet Cat Food Tins Tuna Fillet in Broth - 16 x 70g is 1.14kg because 16 * 70g = 1120g = 1.12kg`,
          role: 'assistant',
        },
        { content: `Given Input: ${input.description}`, role: 'user' },
      ]),
      response: {
        json_schema: {
          properties: {
            totalWeight: {
              type: 'number',
            },
            weightUnit: {
              type: 'string',
            },
          },
          required: ['totalWeight', 'weightUnit'],
          type: 'object',
        },
      },
    }),
    method: 'POST',
  };
  const fetchLLMClient = createFetchLLMClient({ reqeustId: options.requestId });
  try {
    return await fetchLLMClient(requestInit)
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
  } catch {
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
  const { logger } = options;
  const requestInit: RequestInit = {
    body: shapeOfRequestBody({
      prompts: shapeOfPrompts([
        {
          content:
            'You are AI system that able to extract country from address and understand the boundaries of Country.',
          role: 'system',
        },
        {
          content: `Extract country from given address and report do the country extracted within United Kingdom?
Generated response in JSON Object format with 2 key, 'extractedCountry' (string) and 'withInUK' (boolean)
Given Address: Heineken UK Limited,3-4 Broadway Park,Edinburgh,EH12 9JZ.`,
          role: 'user',
        },
        {
          content: JSON.stringify({
            extractedCountry: 'Scotland',
            withInUK: true,
          }),
          role: 'assistant',
        },
        {
          content:
            "Given Address: Brewed at:Sharp's Brewery Ltd.,Rock,Cornwall,PL27 6NU,UK.MCBC (Ireland) DAC,Block J1 Unit Centre,Maynooth Business Campus,Straffan Road,Republic of Ireland.",
          role: 'user',
        },
        {
          content: JSON.stringify({
            extractedCountry: 'Republic of Ireland',
            withInUK: false,
          }),
          role: 'assistant',
        },
        {
          content:
            'Given Address: Brewed and Canned by:Birra Peroni S.r.l.,Via Birolli,8 - Roma,Italy.For:Asahi UK Ltd,Asahi House,88-100 Chertsey Road,Woking,GU21 5BJ,UK.',
          role: 'user',
        },
        {
          content: JSON.stringify({
            extractedCountry: 'Italy',
            withInUK: false,
          }),
          role: 'assistant',
        },
        {
          content:
            'Given Address: Brewed & canned by:Camden Town Brewery,55-59 Wilkin Street,Mews,NW5 3NN,London,UK.',
          role: 'user',
        },
        {
          content: JSON.stringify({
            extractedCountry: 'England',
            withInUK: true,
          }),
          role: 'assistant',
        },
        {
          content:
            'Given Address: Jubel Ltd,170 Kennington Lane,London,SE11 5DP.',
          role: 'user',
        },
        {
          content: JSON.stringify({
            extractedCountry: 'England',
            withInUK: true,
          }),
          role: 'assistant',
        },
        {
          content:
            'Given Address: Brewed by:Heineken UK Limited,3-4 Broadway Park,Edinburgh,EH12 9JZ.HBBV.,Tweede Weteringplantsoen 21,1017 ZD Amsterdam,NL.',
          role: 'user',
        },
        {
          content: JSON.stringify({
            extractedCountry: 'Netherlands',
            withInUK: false,
          }),
          role: 'assistant',
        },
        {
          content: `Given Address: Brewed & canned by:Camden Town Brewery,55-59 Wilkin Street,Mews,NW5 3NN,London,UK`,
          role: 'user',
        },
        {
          content: JSON.stringify({
            extractedCountry: 'England',
            withInUK: true,
          }),
          role: 'assistant',
        },
        {
          content: `Given Address: Brewed and bottled by:
Birra Peroni S.r.l.,
Via Birolli, 8,
Roma.

Asahi UK Ltd,
Asahi House,
88-100 Chertsey Road,
Woking,
GU21 5BJ,
UK.`,
          role: 'user',
        },
        {
          content: JSON.stringify({
            extractedCountry: 'Italy',
            withInUK: false,
          }),
          role: 'assistant',
        },
        {
          content: `Given Address: ${address}`,
          role: 'user',
        },
      ]),
      response: {
        json_schema: {
          properties: {
            extractedCountry: {
              type: 'string',
            },
            withInUK: {
              type: 'boolean',
            },
          },
          required: ['extractedCountry', 'withInUK'],
          type: 'object',
        },
      },
    }),
    method: 'POST',
  };
  const llmFetchClient = createFetchLLMClient({ reqeustId: options.requestId });
  try {
    return await llmFetchClient(requestInit)
      .then(res => res.json())
      .then(jsonRes => {
        return ((content: string) => {
          try {
            logger.info('Parsed JSON response from LLM', {
              address,

              generatedContent: content,
            });
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
