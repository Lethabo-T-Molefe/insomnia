import { getAppWatchUrl } from "@/lib/app-url";
import { requireUser } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";
import {
  createTargetForUser,
  listTargetsForUser,
  updateTargetForUser,
} from "@/lib/targets";
import { MIN_INTERVAL_SECONDS } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ensures this deployment's public URL is on the user's watch list
 * so Insomnia keeps itself awake via normal target pings.
 */
export async function POST() {
  try {
    const user = await requireUser();
    const watchUrl = getAppWatchUrl();
    if (!watchUrl) {
      return Response.json(
        {
          error:
            "NEXT_PUBLIC_APP_URL is not set. Set it to https://insomnia.chopa.dev on Render.",
        },
        { status: 500 },
      );
    }

    const existing = (await listTargetsForUser(user.id)).find((target) => {
      try {
        return (
          new URL(target.url).href === new URL(watchUrl).href ||
          target.url.replace(/\/$/, "") === watchUrl.replace(/\/$/, "")
        );
      } catch {
        return target.url === watchUrl;
      }
    });

    if (existing) {
      const target =
        existing.enabled && existing.intervalSeconds === MIN_INTERVAL_SECONDS
          ? existing
          : await updateTargetForUser(user.id, existing.id, {
              enabled: true,
              intervalSeconds: MIN_INTERVAL_SECONDS,
              label: existing.label || "Insomnia (this app)",
            });

      return Response.json({ target, created: false });
    }

    const target = await createTargetForUser(user.id, {
      url: watchUrl,
      label: "Insomnia (this app)",
      intervalSeconds: MIN_INTERVAL_SECONDS,
      enabled: true,
    });

    void writeAuditEvent({
      actorId: user.id,
      action: "target.self_keepalive",
      entityType: "target",
      entityId: target.id,
      meta: { url: target.url },
    }).catch(() => undefined);

    return Response.json({ target, created: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    return Response.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 },
    );
  }
}
