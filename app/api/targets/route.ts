import { requireUser } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import { createTargetForUser, listTargetsForUser } from "@/lib/targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const targets = await listTargetsForUser(user.id);
    return Response.json({ targets });
  } catch {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      url?: string;
      label?: string;
      intervalSeconds?: number;
      enabled?: boolean;
    };

    if (!body.url || body.intervalSeconds === undefined) {
      return Response.json(
        { error: "url and intervalSeconds are required." },
        { status: 400 },
      );
    }

    const target = await createTargetForUser(user.id, {
      url: body.url,
      label: body.label,
      intervalSeconds: Number(body.intervalSeconds),
      enabled: body.enabled,
    });

    // Never block create on audit write failures / latency.
    void writeAuditEvent({
      actorId: user.id,
      action: "target.created",
      entityType: "target",
      entityId: target.id,
      meta: { url: target.url, label: target.label },
    }).catch((error) => {
      console.error("[api/targets] audit failed", error);
    });

    return Response.json({ target }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    console.error("[api/targets] create failed", message, error);
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("foreign key") || message.includes("users")
          ? 409
          : 400;
    return Response.json({ error: message }, { status });
  }
}
