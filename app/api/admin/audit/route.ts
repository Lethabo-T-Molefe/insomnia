import { requireAdmin } from "@/lib/auth";
import { listAuditEvents } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Number(searchParams.get("limit") ?? 100) || 100,
      250,
    );
    const events = await listAuditEvents(limit);
    return Response.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
