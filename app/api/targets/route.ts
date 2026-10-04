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

    await writeAuditEvent({
      actorId: user.id,
      action: "target.created",
      entityType: "target",
      entityId: target.id,
      meta: { url: target.url, label: target.label },
    });

    return Response.json({ target }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    const status = message === "Unauthorized" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
