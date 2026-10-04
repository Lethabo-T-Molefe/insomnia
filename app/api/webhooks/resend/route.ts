/**
 * Application transactional email is disabled.
 * Auth emails are handled by Clerk. This endpoint remains as a no-op
 * so existing webhook configs do not 404.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({
    ok: true,
    ignored: true,
    reason: "Application emails are disabled; Clerk handles auth email only.",
  });
}
