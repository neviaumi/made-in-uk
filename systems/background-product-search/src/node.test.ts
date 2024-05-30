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
});
