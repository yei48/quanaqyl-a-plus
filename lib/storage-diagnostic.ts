// Log only fixed codes and descriptions, never raw errors, queries or credentials.
const reasons = {
  DATABASE_URL_MISSING: 'DATABASE_URL is not configured',
  DATABASE_URL_INVALID: 'DATABASE_URL must be a valid PostgreSQL connection URL',
  '28P01': 'Database password was rejected',
  '28000': 'Database authorization failed',
  '42501': 'Database role lacks permission',
  '42P01': 'Required database table is missing',
  '3D000': 'Database does not exist',
  ECONNREFUSED: 'Database connection was refused',
  ECONNRESET: 'Database connection was reset',
  ENOTFOUND: 'Database hostname could not be resolved',
  EAI_AGAIN: 'Database DNS lookup temporarily failed',
  ENETUNREACH: 'Database network is unreachable; check the pooler connection URL',
  ETIMEDOUT: 'Database connection timed out',
  CONNECTION_TIMEOUT: 'Database connection timed out',
  SELF_SIGNED_CERT_IN_CHAIN: 'Database certificate authority is missing; check DATABASE_SSL_CERT',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'Database certificate authority is missing; check DATABASE_SSL_CERT',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Database certificate could not be verified; check DATABASE_SSL_CERT',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'Database certificate authority is missing; check DATABASE_SSL_CERT',
  CERT_HAS_EXPIRED: 'Database TLS certificate has expired',
  ERR_TLS_CERT_ALTNAME_INVALID: 'Database hostname does not match its TLS certificate',
} as const;

export function storageDiagnostic(error: unknown): { code: string; reason: string } {
  if (error && typeof error === 'object') {
    const code = 'code' in error ? error.code : undefined;
    if (typeof code === 'string' && Object.hasOwn(reasons, code)) {
      return { code, reason: reasons[code as keyof typeof reasons] };
    }
    if (error instanceof Error && ['Connection terminated due to connection timeout', 'timeout exceeded when trying to connect'].includes(error.message)) {
      return { code: 'CONNECTION_TIMEOUT', reason: reasons.CONNECTION_TIMEOUT };
    }
  }
  return { code: 'STORAGE_ERROR', reason: 'Unclassified storage failure' };
}
