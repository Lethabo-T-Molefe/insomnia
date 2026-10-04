import "server-only";
import { db } from "@/lib/db";
import { writeAuditEvent } from "@/lib/audit";
import type { StatsPayload } from "@/lib/types";

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function listUsersForAdmin() {
  const database = await db();
  const result = await database.execute({
    sql: `SELECT
            u.id,
            u.email,
            u.name,
            u.role,
            u.created_at,
            COUNT(DISTINCT t.id)::int AS target_count,
            COUNT(DISTINCT e.id)::int AS ping_count,
            COUNT(DISTINCT e.id) FILTER (WHERE e.ok)::int AS success_count,
            COALESCE(AVG(e.latency_ms) FILTER (WHERE e.latency_ms IS NOT NULL), 0)::float AS avg_latency
          FROM users u
          LEFT JOIN targets t ON t.user_id = u.id
          LEFT JOIN ping_events e
            ON e.user_id = u.id
           AND e.created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY u.id
          ORDER BY u.created_at DESC`,
  });

  return (
    result.rows as Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      created_at: Date | string;
      target_count: number;
      ping_count: number;
      success_count: number;
      avg_latency: number;
    }>
  ).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "user",
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    targetCount: Number(row.target_count),
    pingCount: Number(row.ping_count),
    successCount: Number(row.success_count),
    avgLatency: Math.round(Number(row.avg_latency)),
  }));
}

export async function setUserRole(input: {
  actorId: string;
  userId: string;
  role: "user" | "admin";
}) {
  const database = await db();
  const result = await database.execute({
    sql: "UPDATE users SET role = ? WHERE id = ? RETURNING id, email, role",
    args: [input.role, input.userId],
  });
  const row = result.rows[0] as
    | { id: string; email: string; role: string }
    | undefined;
  if (!row) throw new Error("User not found.");

  await writeAuditEvent({
    actorId: input.actorId,
    action: "user.role_changed",
    entityType: "user",
    entityId: input.userId,
    meta: { role: input.role, email: row.email },
  });

  return {
    id: row.id,
    email: row.email,
    role: row.role === "admin" ? "admin" : "user",
  };
}

export async function getAdminAnalytics(): Promise<{
  overview: {
    users: number;
    admins: number;
    targets: number;
    enabledTargets: number;
    pings24h: number;
    successRate24h: number;
    avgLatency24h: number;
  };
  stats: StatsPayload;
}> {
  const database = await db();

  const overviewResult = await database.execute({
    sql: `SELECT
            (SELECT COUNT(*)::int FROM users) AS users,
            (SELECT COUNT(*)::int FROM users WHERE role = 'admin') AS admins,
            (SELECT COUNT(*)::int FROM targets) AS targets,
            (SELECT COUNT(*)::int FROM targets WHERE enabled) AS enabled_targets,
            (SELECT COUNT(*)::int FROM ping_events WHERE created_at >= NOW() - INTERVAL '24 hours') AS pings_24h,
            (SELECT COUNT(*)::int FROM ping_events WHERE created_at >= NOW() - INTERVAL '24 hours' AND ok) AS successes_24h,
            (SELECT COALESCE(AVG(latency_ms), 0)::float FROM ping_events WHERE created_at >= NOW() - INTERVAL '24 hours' AND latency_ms IS NOT NULL) AS avg_latency_24h`,
  });

  const overviewRow = overviewResult.rows[0] as {
    users: number;
    admins: number;
    targets: number;
    enabled_targets: number;
    pings_24h: number;
    successes_24h: number;
    avg_latency_24h: number;
  };

  const pings24h = Number(overviewRow.pings_24h);
  const successes24h = Number(overviewRow.successes_24h);

  const series = await database.execute({
    sql: `SELECT
            date_trunc('hour', created_at) AS bucket,
            COUNT(*)::int AS pings,
            COUNT(*) FILTER (WHERE ok)::int AS successes,
            COUNT(*) FILTER (WHERE NOT ok)::int AS failures,
            COALESCE(AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL), 0)::float AS latency
          FROM ping_events
          WHERE created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY 1
          ORDER BY 1 ASC`,
  });

  let points = (
    series.rows as Array<{
      bucket: Date | string;
      pings: number;
      successes: number;
      failures: number;
      latency: number;
    }>
  ).map((row) => ({
    date: iso(row.bucket) ?? new Date().toISOString(),
    pings: Number(row.pings),
    successes: Number(row.successes),
    failures: Number(row.failures),
    latency: Math.round(Number(row.latency)),
  }));

  if (points.length === 1) {
    const only = points[0];
    points = [
      {
        date: new Date(new Date(only.date).getTime() - 60_000).toISOString(),
        pings: 0,
        successes: 0,
        failures: 0,
        latency: only.latency,
      },
      only,
    ];
  }

  return {
    overview: {
      users: Number(overviewRow.users),
      admins: Number(overviewRow.admins),
      targets: Number(overviewRow.targets),
      enabledTargets: Number(overviewRow.enabled_targets),
      pings24h,
      successRate24h:
        pings24h === 0 ? 0 : Math.round((successes24h / pings24h) * 100),
      avgLatency24h: Math.round(Number(overviewRow.avg_latency_24h)),
    },
    stats: {
      points,
      totalPings: pings24h,
      successRate:
        pings24h === 0 ? 0 : Math.round((successes24h / pings24h) * 100),
      avgLatency: Math.round(Number(overviewRow.avg_latency_24h)),
    },
  };
}
