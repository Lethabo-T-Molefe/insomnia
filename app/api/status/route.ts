import { requireUser } from "@/lib/auth";
import { getPingEngine } from "@/lib/ping-engine";
import {
  countTargets,
  listRecentForUser,
  listTargetsForUser,
} from "@/lib/targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const engine = getPingEngine();

    const [targets, recent, counts] = await Promise.all([
      listTargetsForUser(user.id),
      listRecentForUser(user.id),
      countTargets(),
    ]);

    return Response.json({
      running: engine.isRunning(),
      startedAt: engine.getStartedAt(),
      targetCount: targets.length,
      enabledCount: targets.filter((target) => target.enabled).length,
      globalTargetCount: counts.total,
      targets,
      recent,
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    console.error("[api/status]", message, error);
    return Response.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
}
