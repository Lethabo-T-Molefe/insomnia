import postgres from "postgres";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres.gxcguxtxflagnqqcdusq:%40Chop_DB123@aws-0-eu-north-1.pooler.supabase.com:5432/postgres";

const sql = postgres(url, {
  ssl: "require",
  prepare: false,
  max: 1,
  connect_timeout: 12,
  connection: { search_path: "insomnia,public" },
});

const t0 = Date.now();
const row = await sql.unsafe("select 1 as ok");
console.log("ok", row[0], `${Date.now() - t0}ms`);
await sql.end();
