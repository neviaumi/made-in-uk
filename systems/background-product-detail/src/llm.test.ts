import { APP_ENV } from '@/config.ts';
import { extractCountryFromAddress, extractTotalWeight } from '@/llm.ts';
import { createLogger } from '@/logger.ts';
import { createLLMPromptHandler } from '@/mocks/handlers.ts';
import { HttpResponse } from '@/mocks/msw.ts';
import { server } from '@/mocks/node.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  server.listen();
});
afterAll(() => {
  server.close();
});
describe('extractCountryFromAddress', () => {
  it(
    'should return country from address',
    async () => {
      server.use(
        createLLMPromptHandler(() =>
          HttpResponse.json({
            message: JSON.stringify({
              extractedCountry: 'USA',
              withInUK: false,
            }),
          }),
        ),
      );
      const address = '123 Main St, Anytown, USA';
      const { data } = await extractCountryFromAddress(address, {
        logger: createLogger(APP_ENV),
        requestId: 'testing',
      });
      expect(data.extractedCountry).toBe('USA');
    },
    { timeout: 60000 },
  );
});

describe('extractTotalWeight', () => {
  it(
    'should extract total weight from product name',
    async () => {
      server.use(
        createLLMPromptHandler(() =>
          HttpResponse.json({
            message: JSON.stringify({
              totalWeight: 6.8,
              weightUnit: 'kg',
            }),
          }),
        ),
      );
      const name =
        'Hill’s Science Diet Adult Perfect Weight Chicken Recipe Dry Cat Food, 15-lb bag';
      const { data } = await extractTotalWeight(
        { description: name },
        {
          logger: createLogger(APP_ENV),
          requestId: 'testing',
        },
      );
      expect(data.weightUnit).toBe('kg');
      expect(data.totalWeight).toBe(6.8);
    },
    { timeout: 60000 },
  );
});
