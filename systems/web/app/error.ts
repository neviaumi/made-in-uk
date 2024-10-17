export function withErrorCode(
  code: 'ERR_UNAUTHENTICATED' | 'ERR_UNEXPECTED_ERROR' | 'ERR_REVOKED_SESSION',
) {
  return (e: NodeJS.ErrnoException) => {
    e.code = code;
    return e;
  };
}
