import { requireAdmin } from "@/lib/auth";
import { getAdminAnalytics } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const analytics = await getAdminAnalytics();
    return Response.json(analytics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
