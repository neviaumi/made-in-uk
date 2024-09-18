import { Readable } from 'node:stream';
import { setTimeout } from 'node:timers/promises';

import { describe, expect, it } from 'vitest';

import * as generator from '@/generator.ts';

describe('Async Generator', () => {
  it('Combine two async generator', async () => {
    async function* gen1() {
      await setTimeout(500);
      yield 'From gen1, 1';
      await setTimeout(500);
      yield 'From gen1, 2';
    }
    async function* gen2() {
      await setTimeout(500);
      yield 'From gen2, 1';
      await setTimeout(500);
      yield 'From gen2, 2';
      await setTimeout(500);
      yield 'From gen2, 3';
    }

    expect(
      await Readable.from(generator.combine<string>(gen1(), gen2())).toArray(),
    ).toEqual([
      'From gen1, 1',
      'From gen2, 1',
      'From gen1, 2',
      'From gen2, 2',
      'From gen2, 3',
    ]);
  });
});
