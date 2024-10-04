import { isNativeError as _isNativeError } from 'node:util/types';

import { GraphQLError } from 'graphql';

export { createGraphQLError } from 'graphql-yoga';

export function isGraphQLError(e: unknown): e is GraphQLError {
  return isNativeError(e) && e.name === 'GraphQLError';
  // return e instanceof GraphQLError;
}
export function isNativeError(e: unknown): e is NodeJS.ErrnoException {
  return _isNativeError(e);
}

export function withErrorCode(
  code:
    | 'ERR_UNAUTHENTICATED'
    | 'ERR_UNEXPECTED_ERROR'
    | 'ERR_FORBIDDEN_OPERATION',
) {
  return (e: NodeJS.ErrnoException | GraphQLError) => {
    if (isGraphQLError(e)) {
      if (e.extensions['code'])
        throw withErrorCode('ERR_FORBIDDEN_OPERATION')(
          new Error('Override error code is not allowed'),
        );
      Object.assign(e.extensions, { code });
      return e;
    }

    if (isNativeError(e)) {
      if (e.code) {
        throw withErrorCode('ERR_FORBIDDEN_OPERATION')(
          new Error('Override error code is not allowed'),
        );
      }
      e.code = code;
      return e;
    }
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
