import { GoogleAuth } from 'google-auth-library';

import { APP_ENV, AppEnvironment, loadConfig } from '@/config.ts';
import type { Logger } from '@/logger.ts';

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

export const convertMeasurement = withTimeout(DEFAULT_LLM_TIMEOUT)(
  async (
    input: { originalMeasureUnit: string; targetMeasureUnit: string },
    options: {
      logger: Logger;
      requestId: string;
    },
  ) => {
    const logger = options.logger;
    const llmEndpoint = config.get('llm.endpoint');
    if (!llmEndpoint) throw new Error('llm.endpoint is not defined');
    const requestInit: RequestInit = {
      body: JSON.stringify({
        prompt: `<|user|>
Given the original measure unit and target measurement unit, return the convertion rate for me.
Response in JSON object with 3 keys - 
target - the given target measurement i want
source - the original measurement given
rate - the convertion rate (flooring number with up to 4 decimal points)
Given input: Response the convertion from ltr to per 100 ml<|end|>
<|assistant|>${JSON.stringify({ rate: 10, source: 'ltr', target: 'per 100 ml' })}
Explanation:
1 ltr is equal to 1000ml and 1000ml equal to 10 times of 100ml<|end|>
<|user|>Given Input: Response the convertion from per 100 ml to ltr<|end|>
<|assistant|>${JSON.stringify({ rate: 0.01, source: 'per 100 ml', target: 'ltr' })}
Explanation:
1 ltr is equal to 1000ml and 1000ml equal to 0.01 times of 100ml<|end|>
<|user|>Given Input: Response the convertion from ${input.originalMeasureUnit} to ${input.targetMeasureUnit}<|end|>`,
        system:
          'You are AI system that able return the convertion rate of difference measurement .',
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
    } else {
      requestInit.headers = requestInitHeaders;
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
                data: {
                  rate: null,
                  source: input.originalMeasureUnit,
                  target: input.targetMeasureUnit,
                },
                raw: content,
              };
            }
          })((jsonRes as { message: string })['message']);
        });
    } catch (e) {
      return {
        data: {
          rate: null,
          source: input.originalMeasureUnit,
          target: input.targetMeasureUnit,
        },
      };
    }
  },
  {
    data: {
      rate: null,
      source: '',
      target: '',
    },
  },
);

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
  } else {
    requestInit.headers = requestInitHeaders;
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
Generated response in JSON Object format with 2 key, 'extractedCountry' (string) and 'withInUK' (boolean)
Given Address: Heineken UK Limited,3-4 Broadway Park,Edinburgh,EH12 9JZ.<|end|>
<|assistant|>
${JSON.stringify({ extractedCountry: 'Scotland', withInUK: true })}<|end|>
<|user|>
Given Address: Brewed at:Sharp's Brewery Ltd.,Rock,Cornwall,PL27 6NU,UK.MCBC (Ireland) DAC,Block J1 Unit Centre,Maynooth Business Campus,Straffan Road,Republic of Ireland.<|end|>
<|assistant|>
${JSON.stringify({ extractedCountry: 'Republic of Ireland', withInUK: false })}<|end|>
<|user|>
Given Address: Brewed and Canned by:Birra Peroni S.r.l.,Via Birolli,8 - Roma,Italy.For:Asahi UK Ltd,Asahi House,88-100 Chertsey Road,Woking,GU21 5BJ,UK.<|end|>
<|assistant|>
${JSON.stringify({ extractedCountry: 'Italy', withInUK: false })}<|end|>
<|user|>
Given Address: Brewed & canned by:Camden Town Brewery,55-59 Wilkin Street,Mews,NW5 3NN,London,UK.<|end|>
<|assistant|>
${JSON.stringify({ extractedCountry: 'England', withInUK: true })}<|end|>
<|user|>
Given Address: Jubel Ltd,170 Kennington Lane,London,SE11 5DP.<|end|>
<|assistant|>
${JSON.stringify({ extractedCountry: 'England', withInUK: true })}<|end|>
<|user|>
Given Address: Brewed by:Heineken UK Limited,3-4 Broadway Park,Edinburgh,EH12 9JZ.HBBV.,Tweede Weteringplantsoen 21,1017 ZD Amsterdam,NL.<|end|>
<|assistant|>
${JSON.stringify({ extractedCountry: 'Netherlands', withInUK: false })}<|end|>
<|user|>
Given Address: Brewed & canned by:Camden Town Brewery,55-59 Wilkin Street,Mews,NW5 3NN,London,UK.<|end|>
<|assistant|>
${JSON.stringify({ extractedCountry: 'England', withInUK: true })}<|end|>
<|user|>
Given Address: Brewed and bottled by:
Birra Peroni S.r.l.,
Via Birolli, 8,
Roma.

Asahi UK Ltd,
Asahi House,
88-100 Chertsey Road,
Woking,
GU21 5BJ,
UK.<|end|>
<|assistant|>
${JSON.stringify({ extractedCountry: 'Italy', withInUK: false })}<|end|>
<|user|>
Given Address: ${address}<|end|>`,
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
  } else {
    requestInit.headers = requestInitHeaders;
  }
  try {
    return await fetch(new URL('/prompt', llmEndpoint), requestInit)
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
