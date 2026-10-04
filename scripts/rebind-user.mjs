import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

function loadEnv(file) {
  const text = readFileSync(resolve(process.cwd(), file), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    process.env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
}

loadEnv(".env.production");

const email = process.argv[2] ?? "lethabomolefe69@gmail.com";
const newId = process.argv[3] ?? "user_3KF7ezdkRANylwsaJI8Trt0GwNe";

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  prepare: false,
  max: 1,
  connection: { search_path: "insomnia,public" },
  onnotice: () => {},
});

const rows = await sql`
  SELECT id, email, name, role
  FROM users
  WHERE lower(email) = lower(${email})
`;

if (rows.length === 0) {
  await sql`
    INSERT INTO users (id, email, name, role)
    VALUES (${newId}, ${email}, ${"Lethabo Molefe"}, ${"admin"})
  `;
  console.log("Inserted admin user", { id: newId, email });
  await sql.end();
  process.exit(0);
}

const prior = rows[0];
if (prior.id === newId) {
  await sql`UPDATE users SET role = 'admin' WHERE id = ${newId}`;
  console.log("Already bound", prior);
  await sql.end();
  process.exit(0);
}

const tempEmail = `__migrating_${newId}@insomnia.local`;
await sql.begin(async (tx) => {
  await tx`UPDATE users SET email = ${tempEmail} WHERE id = ${prior.id}`;
  await tx`
    INSERT INTO users (id, email, name, role)
    VALUES (${newId}, ${email}, ${prior.name}, ${"admin"})
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role
  `;
  await tx`UPDATE targets SET user_id = ${newId} WHERE user_id = ${prior.id}`;
  await tx`UPDATE ping_events SET user_id = ${newId} WHERE user_id = ${prior.id}`;
  await tx`UPDATE audit_events SET actor_id = ${newId} WHERE actor_id = ${prior.id}`;
  await tx`DELETE FROM users WHERE id = ${prior.id}`;
});

const after = await sql`SELECT id, email, name, role FROM users WHERE id = ${newId}`;
console.log("Rebound", { from: prior.id, to: newId, user: after[0] });
await sql.end();
