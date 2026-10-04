import { requireAdmin } from "@/lib/auth";
import { listUsersForAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const users = await listUsersForAdmin();
    return Response.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
