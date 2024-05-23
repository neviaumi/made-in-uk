import { describe, expect, it } from 'vitest';

import { pipeAsync } from './pipe-async.ts';

describe('pipe async test', () => {
  it('should pipe async', async () => {
    const value = await pipeAsync([
      async i => i + 100,
      i => i * 2,
      async i => i * 10,
    ])(1);
    expect(value).toEqual((1 + 100) * 2 * 10);
  });
});
