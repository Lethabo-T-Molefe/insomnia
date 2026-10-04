import "server-only";
import { db } from "@/lib/db";

export async function getUserEmail(userId: string): Promise<{
  email: string;
  name: string;
} | null> {
  const database = await db();
  const result = await database.execute({
    sql: "SELECT email, name FROM users WHERE id = ?",
    args: [userId],
  });
  const row = result.rows[0] as { email: string; name: string } | undefined;
  return row ?? null;
}
