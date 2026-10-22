/** Only two fixed destinations are needed after an email confirmation. */
export function authDestination(value: string | null) {
  return value === '/auth/reset' ? '/auth/reset' : '/';
}
