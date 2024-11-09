export function withErrorCode(
  code: 'ERR_REVOKED_SESSION' | 'ERR_UNAUTHENTICATED' | 'ERR_UNEXPECTED_ERROR',
) {
  return (e: NodeJS.ErrnoException) => {
    e.code = code;
    return e;
  };
}
