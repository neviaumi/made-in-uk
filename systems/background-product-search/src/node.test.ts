import { describe, expect, it, vi } from 'vitest';

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
