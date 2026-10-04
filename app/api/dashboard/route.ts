import { requireUser } from "@/lib/auth";
import { getPingEngine } from "@/lib/ping-engine";
import {
  getStatsForUser,
  listRecentForUser,
  listTargetsForUser,
} from "@/lib/targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const engine = getPingEngine();
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("stats") !== "0";

    const [targets, recent, stats] = await Promise.all([
      listTargetsForUser(user.id),
      listRecentForUser(user.id, 40),
      includeStats ? getStatsForUser(user.id) : Promise.resolve(null),
    ]);

    return Response.json({
      running: engine.isRunning(),
      startedAt: engine.getStartedAt(),
      targetCount: targets.length,
      enabledCount: targets.filter((target) => target.enabled).length,
      targets,
      recent,
      stats,
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    console.error("[api/dashboard]", message, error);
    return Response.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
}
