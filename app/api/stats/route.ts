import { requireUser } from "@/lib/auth";
import { getStatsForUser } from "@/lib/targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const stats = await getStatsForUser(user.id);
    return Response.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    console.error("[api/stats]", message, error);
    return Response.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
}
