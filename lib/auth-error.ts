export function authErrorLabel(error: unknown): 'invalid' | 'unconfirmed' | 'limit' | 'short' | 'failed' {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof code !== 'string') return 'failed';
  if (code.includes('rate_limit')) return 'limit';
  if (code === 'weak_password') return 'short';
  if (code === 'invalid_credentials') return 'invalid';
  if (code === 'email_not_confirmed') return 'unconfirmed';
  return 'failed';
}
