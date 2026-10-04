import postgres from "postgres";
import dns from "node:dns/promises";

const password = encodeURIComponent("@Chop_DB123");
const ref = "gxcguxtxflagnqqcdusq";

const candidates = [
  process.env.DATABASE_URL,
  // Supabase pooler (IPv4) — try common regions + both ports
  ...[
    "eu-central-1",
    "eu-west-1",
    "eu-west-2",
    "eu-north-1",
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "ap-southeast-1",
    "ap-south-1",
    "af-south-1",
  ].flatMap((region) => [
    `postgresql://postgres.${ref}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:${password}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
  ]),
  // Direct (IPv6) fallback
  `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`,
].filter(Boolean);

async function tryUrl(url) {
  const host = new URL(url).hostname;
  try {
    const records = await dns.lookup(host, { all: true });
    console.log(`DNS ${host}:`, records.map((r) => `${r.address}/${r.family}`).join(", "));
  } catch (error) {
    console.log(`DNS ${host}: fail`, error instanceof Error ? error.message : error);
    return false;
  }

  const sql = postgres(url, {
    ssl: "require",
    max: 1,
    connect_timeout: 12,
    prepare: false,
    connection: { search_path: "insomnia,public" },
    onnotice: () => {},
  });

  try {
    const rows = await sql`select current_database() as db, current_user as usr`;
    console.log("CONNECTED", url.replace(password, "***"), rows[0]);
    await sql.begin(async (tx) => {
      await tx.unsafe("CREATE SCHEMA IF NOT EXISTS insomnia");
    });
    await sql.end();
    console.log("WORKING_URL=" + url);
    return true;
  } catch (error) {
    console.log("FAIL", host, error instanceof Error ? error.message : error);
    await sql.end().catch(() => {});
    return false;
  }
}

for (const url of candidates) {
  const ok = await tryUrl(url);
  if (ok) process.exit(0);
}

console.error("No working Supabase connection string found.");
process.exit(1);
