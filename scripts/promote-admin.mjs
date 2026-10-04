import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const email = process.argv[2] ?? "lethabomolefe69@gmail.com";
const sql = postgres(url, {
  ssl: false,
  connection: { search_path: "insomnia" },
  onnotice: () => {},
});

await sql.begin(async (tx) => {
  await tx.unsafe(`CREATE SCHEMA IF NOT EXISTS insomnia`);
  await tx.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`);
  await tx.unsafe(`CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await tx.unsafe(
    `UPDATE users SET role = 'admin' WHERE lower(email) = lower($1)`,
    [email],
  );
});

const rows = await sql.unsafe(`SELECT id, email, name, role FROM users ORDER BY created_at`);
console.log(JSON.stringify(rows, null, 2));
await sql.end();
