import { requireAdmin } from "@/lib/auth";
import { setUserRole } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/users/[id]">,
) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = (await request.json()) as { role?: string };

    if (body.role !== "user" && body.role !== "admin") {
      return Response.json(
        { error: "role must be user or admin." },
        { status: 400 },
      );
    }

    if (id === admin.id && body.role !== "admin") {
      return Response.json(
        { error: "You cannot demote yourself." },
        { status: 400 },
      );
    }

    const user = await setUserRole({
      actorId: admin.id,
      userId: id,
      role: body.role,
    });

    return Response.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden"
          ? 403
          : message === "User not found."
            ? 404
            : 400;
    return Response.json({ error: message }, { status });
  }
}
