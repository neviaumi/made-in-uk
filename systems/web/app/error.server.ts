import { isNativeError as _isNativeError } from 'node:util/types';

export function isNativeError(e: unknown): e is NodeJS.ErrnoException {
  return _isNativeError(e);
}

export function withErrorCode(
  code: 'ERR_UNAUTHENTICATED' | 'ERR_UNEXPECTED_ERROR' | 'ERR_REVOKED_SESSION',
) {
  return (e: NodeJS.ErrnoException) => {
    e.code = code;
    return e;
  };
}
