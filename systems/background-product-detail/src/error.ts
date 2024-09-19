import { isNativeError as _isNativeError } from 'node:util/types';

export function isNativeError(e: unknown): e is NodeJS.ErrnoException {
  return _isNativeError(e);
}

export function withErrorCode(
  code: 'ERR_RATE_LIMIT_EXCEEDED' | 'ERR_UNEXPECTED_ERROR',
) {
  return (e: NodeJS.ErrnoException) => {
    e.code = code;
    return e;
  };
}

export type HTTPError = NodeJS.ErrnoException & {
  http: { message: string; retryAble: boolean; statusCode: number };
};

export function isHTTPError(e: unknown): e is HTTPError {
  if (
    typeof e === 'object' &&
    e &&
    Object.prototype.hasOwnProperty.call(e, 'http')
  ) {
    const { http } = e as HTTPError;
    return (
      typeof http.message === 'string' && typeof http.statusCode === 'number'
    );
  }
  return false;
}
export function withHTTPError(
  statusCode: number,
  message: string,
  options?: { retryAble: boolean },
) {
  return (e: NodeJS.ErrnoException): HTTPError => {
    e.message = message;
    return Object.assign(e, {
      http: { message, retryAble: options?.retryAble ?? false, statusCode },
    });
  };
}
