import { requireUser } from "@/lib/auth";
import { getPingEngine } from "@/lib/ping-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/targets/[id]/ping">,
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const target = await getPingEngine().pingNow(user.id, id);
    return Response.json({ target });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Target not found."
          ? 404
          : 400;
    return Response.json({ error: message }, { status });
  }
}
