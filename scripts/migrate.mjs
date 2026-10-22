import { readdir, readFile } from 'node:fs/promises';
import { Client } from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local before running db:migrate');
const url = new URL(process.env.DATABASE_URL);
for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CERT ? { ca: process.env.DATABASE_SSL_CERT } : {}) } });
try {
  await client.connect();
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const filename of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    await client.query(await readFile(new URL(filename, directory), 'utf8'));
    console.log(`Applied ${filename}`);
  }
} catch (error) {
  // Never print a connection string or password.
  console.error('Migration failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally { await client.end(); }
