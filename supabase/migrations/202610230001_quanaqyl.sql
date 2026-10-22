BEGIN;
CREATE SCHEMA IF NOT EXISTS quanaqyl;
REVOKE ALL ON SCHEMA quanaqyl FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS quanaqyl.profiles (
  user_id text PRIMARY KEY, data text NOT NULL, photo_key text, updated_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS quanaqyl.attempts (
  user_id text NOT NULL, id text NOT NULL, data text NOT NULL, created_at bigint NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS attempts_user_date ON quanaqyl.attempts (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS quanaqyl.awards (
  user_id text NOT NULL, key text NOT NULL, amount integer NOT NULL CHECK (amount > 0), created_at bigint NOT NULL,
  PRIMARY KEY (user_id, key)
);
CREATE TABLE IF NOT EXISTS quanaqyl.pauses (
  user_id text NOT NULL, id text NOT NULL, start bigint NOT NULL, "end" bigint,
  PRIMARY KEY (user_id, id), CHECK ("end" IS NULL OR "end" >= start)
);
CREATE UNIQUE INDEX IF NOT EXISTS pauses_one_active ON quanaqyl.pauses (user_id) WHERE "end" IS NULL;
CREATE TABLE IF NOT EXISTS quanaqyl.shop_purchases (
  user_id text NOT NULL, id text NOT NULL, product_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price integer NOT NULL CHECK (unit_price > 0),
  total integer NOT NULL CHECK (total = quantity * unit_price), created_at bigint NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS shop_purchases_user_date ON quanaqyl.shop_purchases (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS quanaqyl.focus_timers (
  user_id text PRIMARY KEY, data text NOT NULL, revision integer NOT NULL CHECK (revision >= 0), request_id text NOT NULL
);
CREATE TABLE IF NOT EXISTS quanaqyl.focus_sessions (
  user_id text NOT NULL, id text NOT NULL, started_at bigint NOT NULL, ended_at bigint NOT NULL,
  planned_ms bigint NOT NULL, focus_ms bigint NOT NULL, completed integer NOT NULL,
  PRIMARY KEY (user_id, id),
  CONSTRAINT focus_valid_duration CHECK (focus_ms > 0 AND focus_ms <= planned_ms AND planned_ms BETWEEN 60000 AND 7200000),
  CONSTRAINT focus_valid_dates CHECK (ended_at >= started_at AND focus_ms <= ended_at - started_at),
  CONSTRAINT focus_valid_completion CHECK (completed IN (0,1) AND (completed = 0 OR focus_ms = planned_ms))
);
CREATE INDEX IF NOT EXISTS focus_sessions_user_date ON quanaqyl.focus_sessions (user_id, ended_at DESC);
-- Server-only schema. Never add it to the Supabase Data API exposed schemas.
REVOKE ALL ON ALL TABLES IN SCHEMA quanaqyl FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA quanaqyl REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER TABLE quanaqyl.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quanaqyl.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quanaqyl.awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE quanaqyl.pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quanaqyl.shop_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE quanaqyl.focus_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quanaqyl.focus_sessions ENABLE ROW LEVEL SECURITY;
COMMIT;
