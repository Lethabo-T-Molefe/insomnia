import "server-only";
import postgres from "postgres";

const SCHEMA_NAME = "insomnia";

const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^DATABASE_URL=/, "");

export const databaseHost = (() => {
  try {
    return new URL(databaseUrl ?? "").hostname || null;
  } catch {
    return null;
  }
})();

const SCHEMA = [
  `CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE users DROP COLUMN IF EXISTS password_hash`,
  `ALTER TABLE users DROP COLUMN IF EXISTS welcome_email_sent`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`,
  `DROP TABLE IF EXISTS sessions`,
  `CREATE TABLE IF NOT EXISTS targets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    label TEXT NOT NULL,
    interval_seconds INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ping_at TIMESTAMPTZ,
    last_ping_ok BOOLEAN,
    last_ping_status INTEGER,
    last_ping_latency_ms INTEGER,
    last_ping_error TEXT,
    next_ping_at TIMESTAMPTZ,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_alert_at TIMESTAMPTZ
  )`,
  `ALTER TABLE targets ADD COLUMN IF NOT EXISTS last_alert_at TIMESTAMPTZ`,
  `CREATE INDEX IF NOT EXISTS targets_by_user ON targets (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS targets_due ON targets (enabled, next_ping_at)`,
  `CREATE TABLE IF NOT EXISTS ping_events (
    id TEXT PRIMARY KEY,
    target_id TEXT NOT NULL REFERENCES targets (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    ok BOOLEAN NOT NULL,
    status INTEGER,
    latency_ms INTEGER,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS ping_events_by_user_time ON ping_events (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS ping_events_by_target_time ON ping_events (target_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS audit_events_by_time ON audit_events (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS audit_events_by_actor ON audit_events (actor_id, created_at DESC)`,
];

type Value = string | number | boolean | null | Date;
type Statement = string | { sql: string; args?: Value[] };
type Row = Record<string, unknown>;

export type Database = {
  execute(statement: Statement): Promise<{ rows: Row[] }>;
  batch(statements: Statement[]): Promise<void>;
};

function prepare(statement: Statement) {
  const { sql, args = [] } = typeof statement === "string" ? { sql: statement } : statement;
  let index = 0;
  return { text: sql.replace(/\?/g, () => `$${++index}`), args };
}

function needsSsl(url: string) {
  try {
    const host = new URL(url).hostname;
    return !(host === "localhost" || host === "127.0.0.1");
  } catch {
    return true;
  }
}

async function open(): Promise<Database> {
  const url = databaseUrl;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, {
    ssl: needsSsl(url) ? "require" : false,
    // Supabase transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    max: 5,
    idle_timeout: 30,
    connect_timeout: 15,
    connection: { search_path: `${SCHEMA_NAME},public` },
    onnotice: () => {},
  });

  await sql.begin(async (tx) => {
    for (const statement of SCHEMA) await tx.unsafe(statement);
  });

  return {
    async execute(statement) {
      const { text, args } = prepare(statement);
      return { rows: [...(await sql.unsafe(text, args))] as Row[] };
    },
    async batch(statements) {
      await sql.begin(async (tx) => {
        for (const statement of statements) {
          const { text, args } = prepare(statement);
          await tx.unsafe(text, args);
        }
      });
    },
  };
}

const cache = globalThis as { insomniaPg?: Promise<Database> };

export function db() {
  return (cache.insomniaPg ??= open().catch((error) => {
    cache.insomniaPg = undefined;
    throw error;
  }));
}
