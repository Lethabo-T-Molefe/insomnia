import { getPingEngine } from "@/lib/ping-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public keep-alive endpoint — no auth.
 * Hitting this wakes the process and ensures the ping engine is running,
 * so watches continue even when no one has the dashboard open.
 */
export async function GET() {
  const engine = getPingEngine();
  return Response.json(
    {
      ok: true,
      service: "insomnia",
      running: engine.isRunning(),
      startedAt: engine.getStartedAt(),
      now: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function HEAD() {
  getPingEngine();
  return new Response(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
