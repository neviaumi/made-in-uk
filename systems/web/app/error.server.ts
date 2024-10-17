import { isNativeError as _isNativeError } from 'node:util/types';

export function isNativeError(e: unknown): e is NodeJS.ErrnoException {
  return _isNativeError(e);
}
