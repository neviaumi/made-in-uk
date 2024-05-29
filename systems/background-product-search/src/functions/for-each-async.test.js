import { describe, expect, it, vi } from 'vitest';

import { forEachAsync } from './for-each-async.ts';

describe('for async test', () => {
  it('should execute function for each item', async () => {
    const func = vi.fn();
    await forEachAsync(func, [1, 2, 3]);
    expect(func).toHaveBeenCalledTimes(3);
    expect(func.mock.calls[0]).toEqual([1]);
    expect(func.mock.calls[1]).toEqual([2]);
    expect(func.mock.calls[2]).toEqual([3]);
  });
});
