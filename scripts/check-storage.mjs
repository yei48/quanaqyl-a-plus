import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { testModules } from './test-support.mjs';

// Runs the actual PostgreSQL migrations and services in a temporary PG engine.
// No Supabase account, production data or credentials are used.
const modules = await testModules();
let pg;
try {
  const { Database } = await modules.load('db/adapter');
  const { commandFocus, getFocusState } = await modules.load('lib/focus-server');
  const { purchaseProduct, getShopState } = await modules.load('lib/shop-server');
  const { changePause } = await modules.load('lib/pause-server');
  const { shopProducts } = await modules.load('lib/shop');
  const { analyzeFocus } = await modules.load('lib/focus');
  pg = new PGlite(join(modules.directory, 'database'));
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id text PRIMARY KEY, bucket_id text, name text);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1, '/') $$;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;`);
  for (const file of ['202610230001_quanaqyl.sql', '202610230002_photos.sql']) {
    const sql = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
    await pg.exec(sql); await pg.exec(sql); // Applying the setup again preserves data/schema.
  }
  function transport(connection, inTransaction = false) {
    return {
      async query(text, values) {
        const result = await connection.query(text, values);
        const rows = result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value])));
        return { rows, rowCount: result.affectedRows ?? rows.length };
      },
      async transaction(work, isolation) {
        if (inTransaction) return work(transport(connection, true));
        return connection.transaction(async tx => {
          if (isolation === 'repeatable read') await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
          return work(transport(tx, true));
        });
      },
    };
  }
  let db = new Database(transport(pg));
  const t0 = Date.UTC(2026, 9, 23, 10);
  const cmd = (action, revision, extra = {}) => ({ action, revision, requestId: randomUUID(), ...extra });
  const start = cmd('start', 0, { workMinutes: 1, breakMinutes: 1 });
  let focus = await commandFocus(db, 'alice', start, t0);
  assert.equal(focus.timer.deadline, t0 + 60000);
  assert.equal((await commandFocus(db, 'alice', start, t0 + 2000)).timer.revision, 1);
  focus = await commandFocus(db, 'alice', cmd('pause', 1), t0 + 15000);
  assert.equal(focus.timer.remainingMs, 45000);
  focus = await commandFocus(db, 'alice', cmd('resume', 2), t0 + 3600000);
  const end = t0 + 3645000, complete = cmd('sync', 3);
  focus = await commandFocus(db, 'alice', complete, end + 1000);
  assert.equal(focus.timer.phase, 'break'); assert.equal(focus.sessions.length, 1);
  assert.equal(focus.sessions[0].focusMs, 60000); assert.equal(focus.sessions[0].endedAt, end);
  assert.equal((await commandFocus(db, 'alice', complete, end + 2000)).sessions.length, 1);
  assert.equal(analyzeFocus(focus.sessions, new Date(end + 2000)).completed, 1);
  assert.equal((await getFocusState(db, 'bob', end)).sessions.length, 0);
  await assert.rejects(commandFocus(db, 'alice', cmd('pause', 0), end), { message: 'focusConflict' });
  const race = await Promise.allSettled([
    commandFocus(db, 'bob', cmd('start', 0, { workMinutes: 1, breakMinutes: 1 }), end),
    commandFocus(db, 'bob', cmd('start', 0, { workMinutes: 2, breakMinutes: 1 }), end),
  ]);
  assert.equal(race.filter(value => value.status === 'fulfilled').length, 1);

  const product = shopProducts[0], request = { productId: product.id, quantity: 1, requestId: randomUUID() };
  await db.prepare('INSERT INTO quanaqyl.awards VALUES ($1,$2,$3,$4)').bind('alice', 'test', product.price, t0).run();
  const purchases = await Promise.allSettled([
    purchaseProduct(db, 'alice', request), purchaseProduct(db, 'alice', { ...request, requestId: randomUUID() }),
  ]);
  assert.equal(purchases.filter(value => value.status === 'fulfilled').length, 1, 'cannot overspend');
  const successful = purchases.find(value => value.status === 'fulfilled').value;
  const retry = await purchaseProduct(db, 'alice', { ...request, requestId: successful.receipt.id });
  assert.equal(retry.shop.balance, 0); assert.equal(retry.shop.purchases.length, 1);
  assert.equal(retry.shop.purchases[0].productId, product.id, 'camel-case aliases preserved');
  await assert.rejects(purchaseProduct(db, 'alice', { ...request, requestId: successful.receipt.id, quantity: 2 }), { message: 'shopConflict' });
  assert.equal((await getShopState(db, 'bob')).spent, 0);
  await assert.rejects(purchaseProduct(db, 'bob', request), { message: 'shopInsufficient' });
  await assert.rejects(db.batch([
    db.prepare('INSERT INTO quanaqyl.awards VALUES ($1,$2,$3,$4)').bind('rollback', 'test', 100, t0),
    db.prepare('INSERT INTO quanaqyl.awards VALUES ($1,$2,$3,$4)').bind('rollback', 'bad', -1, t0),
  ]));
  assert.equal((await getShopState(db, 'rollback')).earned, 0, 'failed batch rolls back fully');
  assert.equal((await Promise.all([changePause(db, 'alice', 'pause', t0), changePause(db, 'alice', 'pause', t0)])).filter(Boolean).length, 1);
  for (let i = 1; i < 5; i++) { await changePause(db, 'alice', 'resume', t0 + i * 1000); assert.equal(await changePause(db, 'alice', 'pause', t0 + i * 1000), true); }
  await changePause(db, 'alice', 'resume', t0 + 10000);
  assert.equal(await changePause(db, 'alice', 'pause', t0 + 11000), false, 'five pauses per month');
  const injection = "a'); DROP SCHEMA quanaqyl CASCADE; --";
  await getFocusState(db, injection, t0);
  assert.equal((await getFocusState(db, 'alice', end)).sessions.length, 1, 'SQL parameters are never interpolated');

  const alice = '00000000-0000-4000-8000-000000000001', bob = '00000000-0000-4000-8000-000000000002';
  await pg.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${alice}',false);`);
  await assert.rejects(pg.query('SELECT * FROM quanaqyl.profiles'), /permission denied/);
  await pg.query('INSERT INTO storage.objects VALUES ($1,$2,$3)', ['a', 'profile-photos', `${alice}/photo`]);
  await assert.rejects(pg.query('INSERT INTO storage.objects VALUES ($1,$2,$3)', ['b', 'profile-photos', `${bob}/photo`]), /row-level security/);
  await pg.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [bob]);
  assert.equal((await pg.query('SELECT * FROM storage.objects')).rows.length, 0, 'photo isolation');
  assert.equal((await pg.query('DELETE FROM storage.objects WHERE id=$1', ['a'])).affectedRows, 0);
  await pg.exec('RESET ROLE');
  assert.equal((await pg.query("SELECT public FROM storage.buckets WHERE id='profile-photos'")).rows[0].public, false);
  await pg.close(); pg = new PGlite(join(modules.directory, 'database')); db = new Database(transport(pg));
  assert.equal((await getFocusState(db, 'alice', end)).sessions.length, 1, 'persistent focus history');
  assert.equal((await getShopState(db, 'alice')).purchases.length, 1, 'persistent purchases');
  console.log('PostgreSQL checks passed: migrations, persistence, rollback, timer, purchase retries, concurrency, pause limits, parameter binding, private schema and photo RLS.');
} finally { await pg?.close(); await modules.close(); }
