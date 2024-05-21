import { Readable } from 'node:stream';
import { isNativeError } from 'node:util/types';

import { describe, expect, it, vi } from 'vitest';

describe('node:stream', () => {
  describe('Readable.from', () => {
    it('create stream from generator and it should iterable', async () => {
      async function* generate() {
        yield 'hello';
        yield 'streams';
      }
      const readableStream = Readable.from(generate());
      const results: string[] = [];
      for await (const chunk of readableStream) {
        results.push(chunk);
      }
      expect(results).toEqual(['hello', 'streams']);
    });
  });
});

describe('AsyncGenerator', () => {
  it('error should catchable from try catch', async () => {
    async function* generate() {
      yield 'hello';
      throw new Error('error');
    }
    const finalHandler = vi.fn();
    const readableStream = Readable.from(generate());
    const results: string[] = [];
    try {
      for await (const chunk of readableStream) {
        results.push(chunk);
      }
    } catch (error) {
      if (!isNativeError(error)) throw error;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('error');
    } finally {
      finalHandler();
    }
    expect(results).toEqual(['hello']);
    expect(finalHandler).toHaveBeenCalled();
  });
});
