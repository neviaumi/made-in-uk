import { Readable } from 'node:stream';
import { setTimeout } from 'node:timers/promises';

import { describe, expect, it, vi } from 'vitest';

describe('Async Generator', () => {
  it('Create generator from Array', async () => {
    async function* fromArray() {
      yield* [1, 2, 3];
    }
    expect(await Readable.from(fromArray()).toArray()).toEqual([1, 2, 3]);
  });
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
    async function* combined<T>(...args: AsyncGenerator<T>[]) {
      let done = false;
      while (!done) {
        done = true;
        const generatedResult = await Promise.all(
          args.map(iterator => iterator.next()),
        );
        for (const { done: iteratorDone, value } of generatedResult) {
          if (!iteratorDone) {
            done = false; // If any generator still has values, continue the loop
            yield value;
          }
        }
      }
    }
    expect(await Readable.from(combined(gen1(), gen2())).toArray()).toEqual([
      'From gen1, 1',
      'From gen2, 1',
      'From gen1, 2',
      'From gen2, 2',
      'From gen2, 3',
    ]);
  });
});

describe('Promise', () => {
  describe('Promise.finally', () => {
    it('should call when async function throw a error', async () => {
      async function alwayThrows() {
        throw new Error('error');
      }
      const callOnFinally = vi.fn();
      try {
        await alwayThrows().finally(callOnFinally);
      } catch (e) {
        // noop
      }
      expect(callOnFinally).toHaveBeenCalled();
    });
  });

  describe('Promise.allSettled', () => {
    it('should show error on reason fill', async () => {
      const results = await Promise.allSettled([
        (async () => {
          throw new Error('Ummm?');
        })().finally(),
        (async () => {
          return 'Hello, World!';
        })(),
      ]);
      expect(results).toHaveLength(2);
      expect(results[0].status).toEqual('rejected');
      if (results[0].status === 'rejected') {
        expect(results[0].reason).toBeInstanceOf(Error);
      }
      expect(results[1].status).toEqual('fulfilled');
      if (results[1].status === 'fulfilled') {
        expect(results[1].value).toEqual('Hello, World!');
      }
    });
  });
});
