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

async function findUser(id: string): Promise<AuthUser | null> {
  const database = await db();
  const result = await database.execute({
    sql: "SELECT id, email, name, role FROM users WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0] as
    | { id: string; email: string; name: string; role: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "user",
  };
}

async function upsertClerkUser(input: {
  id: string;
  email: string;
  name: string;
}): Promise<AuthUser> {
  const database = await db();
  const existing = await database.execute({
    sql: "SELECT role FROM users WHERE id = ?",
    args: [input.id],
  });
  const existingRole = (existing.rows[0] as { role?: string } | undefined)?.role;
  const role = roleForEmail(input.email, existingRole);

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

  return { ...input, role };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await findUser(userId);
  if (existing) {
    // Keep admin list in sync without calling Clerk on every request.
    const desired = roleForEmail(existing.email, existing.role);
    if (desired === "admin" && existing.role !== "admin") {
      const database = await db();
      await database.execute({
        sql: "UPDATE users SET role = 'admin' WHERE id = ?",
        args: [existing.id],
      });
      return { ...existing, role: "admin" };
    }
    return existing;
  }

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
