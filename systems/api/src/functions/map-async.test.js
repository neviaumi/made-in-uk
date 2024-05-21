import { describe, expect, it } from 'vitest';

import { MAP_SKIP, mapAsync } from './map-async.ts';

describe('map async test', () => {
  it('should map async', async () => {
    const values = await mapAsync(async item => item * 2, [1, 2, 3]);
    expect(values).toEqual([2, 4, 6]);
  });

  it('should respect skip item return', async () => {
    const values = await mapAsync(
      async item => {
        return item % 2 === 0 ? MAP_SKIP : item * 2;
      },
      Array.from({ length: 10 }, (_, i) => i),
    );
    expect(values).toEqual([2, 6, 10, 14, 18]);
  });
});
