import { requireUser } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import {
  deleteTargetForUser,
  updateTargetForUser,
} from "@/lib/targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/targets/[id]">,
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      url?: string;
      label?: string;
      intervalSeconds?: number;
      enabled?: boolean;
    };

    const target = await updateTargetForUser(user.id, id, {
      url: body.url,
      label: body.label,
      intervalSeconds:
        body.intervalSeconds === undefined
          ? undefined
          : Number(body.intervalSeconds),
      enabled: body.enabled,
    });

    void writeAuditEvent({
      actorId: user.id,
      action: "target.updated",
      entityType: "target",
      entityId: target.id,
      meta: {
        enabled: target.enabled,
        intervalSeconds: target.intervalSeconds,
        label: target.label,
      },
    }).catch((error) => {
      console.error("[api/targets] audit failed", error);
    });

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

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/targets/[id]">,
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await deleteTargetForUser(user.id, id);

    void writeAuditEvent({
      actorId: user.id,
      action: "target.deleted",
      entityType: "target",
      entityId: id,
    }).catch((error) => {
      console.error("[api/targets] audit failed", error);
    });

    return Response.json({ ok: true });
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
