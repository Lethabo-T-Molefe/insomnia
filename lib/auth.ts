import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export type UserRole = "user" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

const USER_CACHE_TTL_MS = 45_000;

const runtime = globalThis as {
  insomniaUserCache?: Map<string, { user: AuthUser; expires: number }>;
};

function userCache() {
  return (runtime.insomniaUserCache ??= new Map());
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function roleForEmail(email: string, existingRole?: string): UserRole {
  if (adminEmails().includes(email.toLowerCase())) return "admin";
  if (existingRole === "admin") return "admin";
  return "user";
}

function toAuthUser(row: {
  id: string;
  email: string;
  name: string;
  role: string;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "user",
  };
}

function remember(user: AuthUser) {
  userCache().set(user.id, {
    user,
    expires: Date.now() + USER_CACHE_TTL_MS,
  });
  return user;
}

function cached(userId: string): AuthUser | null {
  const hit = userCache().get(userId);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    userCache().delete(userId);
    return null;
  }
  return hit.user;
}

async function findUser(id: string): Promise<AuthUser | null> {
  const database = await db();
  const result = await database.execute({
    sql: "SELECT id, email, name, role FROM users WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0] as
    | { id: string; email: string; name: string; role: string }
    | undefined;
  return row ? toAuthUser(row) : null;
}

async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const database = await db();
  const result = await database.execute({
    sql: "SELECT id, email, name, role FROM users WHERE lower(email) = lower(?)",
    args: [email],
  });
  const row = result.rows[0] as
    | { id: string; email: string; name: string; role: string }
    | undefined;
  return row ? toAuthUser(row) : null;
}

async function rebindClerkUserId(input: {
  oldId: string;
  newId: string;
  email: string;
  name: string;
  role: UserRole;
}): Promise<AuthUser> {
  const database = await db();
  const tempEmail = `__migrating_${input.newId}@insomnia.local`;

  await database.batch([
    {
      sql: "UPDATE users SET email = ? WHERE id = ?",
      args: [tempEmail, input.oldId],
    },
    {
      sql: `INSERT INTO users (id, email, name, role)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE
            SET email = EXCLUDED.email,
                name = EXCLUDED.name,
                role = EXCLUDED.role`,
      args: [input.newId, input.email, input.name, input.role],
    },
    {
      sql: "UPDATE targets SET user_id = ? WHERE user_id = ?",
      args: [input.newId, input.oldId],
    },
    {
      sql: "UPDATE ping_events SET user_id = ? WHERE user_id = ?",
      args: [input.newId, input.oldId],
    },
    {
      sql: "UPDATE audit_events SET actor_id = ? WHERE actor_id = ?",
      args: [input.newId, input.oldId],
    },
    {
      sql: "DELETE FROM users WHERE id = ?",
      args: [input.oldId],
    },
  ]);

  userCache().delete(input.oldId);
  return remember({
    id: input.newId,
    email: input.email,
    name: input.name,
    role: input.role,
  });
}

async function upsertClerkUser(input: {
  id: string;
  email: string;
  name: string;
}): Promise<AuthUser> {
  const database = await db();

  const byId = await findUser(input.id);
  if (byId) {
    const role = roleForEmail(input.email, byId.role);
    if (
      byId.email !== input.email ||
      byId.name !== input.name ||
      byId.role !== role
    ) {
      await database.execute({
        sql: `UPDATE users
              SET email = ?, name = ?, role = ?
              WHERE id = ?`,
        args: [input.email, input.name, role, input.id],
      });
    }
    return remember({ ...input, role });
  }

  const byEmail = await findUserByEmail(input.email);
  if (byEmail && byEmail.id !== input.id) {
    const role = roleForEmail(input.email, byEmail.role);
    return rebindClerkUserId({
      oldId: byEmail.id,
      newId: input.id,
      email: input.email,
      name: input.name,
      role,
    });
  }

  const role = roleForEmail(input.email, byEmail?.role);
  await database.execute({
    sql: `INSERT INTO users (id, email, name, role)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE
          SET email = EXCLUDED.email,
              name = EXCLUDED.name,
              role = CASE
                WHEN EXCLUDED.role = 'admin' THEN 'admin'
                ELSE users.role
              END`,
    args: [input.id, input.email, input.name, role],
  });

  return remember({ ...input, role });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const fromCache = cached(userId);
  if (fromCache) {
    const desired = roleForEmail(fromCache.email, fromCache.role);
    if (desired === fromCache.role) return fromCache;
  }

  const existing = await findUser(userId);
  if (existing) {
    const desired = roleForEmail(existing.email, existing.role);
    if (desired === "admin" && existing.role !== "admin") {
      const database = await db();
      await database.execute({
        sql: "UPDATE users SET role = 'admin' WHERE id = ?",
        args: [existing.id],
      });
      return remember({ ...existing, role: "admin" });
    }
    return remember(existing);
  }

  // Slow path: only for brand-new users (Clerk API round-trip).
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser.username ||
    email.split("@")[0];

  return upsertClerkUser({ id: userId, email, name });
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Forbidden");
  return user;
}
