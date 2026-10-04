import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url, {
  ssl: "require",
  prepare: false,
  max: 1,
  connect_timeout: 20,
  connection: { search_path: "insomnia,public" },
  onnotice: () => {},
});

const statements = [
  `CREATE SCHEMA IF NOT EXISTS insomnia`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`,
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

try {
  await sql.begin(async (tx) => {
    for (const statement of statements) {
      await tx.unsafe(statement);
    }
  });

  const adminEmail = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)[0];

  if (adminEmail) {
    await sql.unsafe(
      `UPDATE users SET role = 'admin' WHERE lower(email) = lower($1)`,
      [adminEmail],
    );
  }

  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'insomnia'
    order by table_name
  `;
  const users = await sql`select id, email, role from users`;
  console.log("Migrated tables:", tables.map((row) => row.table_name));
  console.log("Users:", users);
  await sql.end();
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  await sql.end().catch(() => {});
  process.exit(1);
}
