import 'server-only';
import { Pool, types, type PoolClient } from 'pg';
import { Database, type Transport, type Isolation } from './adapter';

types.setTypeParser(20, value => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds safe range');
  return number;
});
let pool: Pool | undefined;
function connectionPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  pool = new Pool({
    connectionString: url.toString(), max: 1, idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000, allowExitOnIdle: true,
    ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CERT ? { ca: process.env.DATABASE_SSL_CERT } : {}) },
  });
  pool.on('error', () => console.error('Idle database connection failed'));
  return pool;
}
function transport(client?: PoolClient): Transport {
  return {
    // Unnamed queries are compatible with Supabase transaction pooling.
    async query(text, values) {
      const result = await (client ?? connectionPool()).query(text, values);
      return { rows: result.rows, rowCount: result.rowCount };
    },
    async transaction<T>(work: (tx: Transport) => Promise<T>, isolation: Isolation = 'read committed'): Promise<T> {
      if (client) return work(transport(client));
      const connection = await connectionPool().connect();
      try {
        await connection.query(isolation === 'repeatable read' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ' : 'BEGIN');
        await connection.query("SET LOCAL statement_timeout = '15000ms'");
        const result = await work(transport(connection));
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { connection.release(); }
    },
  };
}
export function database() { return new Database(transport()); }
