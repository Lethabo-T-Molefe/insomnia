import { db } from "@/lib/db";
import type {
  CreateTargetInput,
  RecentEvent,
  StatsPayload,
  Target,
  UpdateTargetInput,
} from "@/lib/types";
import {
  normalizeInterval,
  normalizeLabel,
  normalizeUrl,
} from "@/lib/validation";

type TargetRow = {
  id: string;
  user_id: string;
  url: string;
  label: string;
  interval_seconds: number;
  enabled: boolean;
  created_at: Date | string;
  last_ping_at: Date | string | null;
  last_ping_ok: boolean | null;
  last_ping_status: number | null;
  last_ping_latency_ms: number | null;
  last_ping_error: string | null;
  next_ping_at: Date | string | null;
  success_count: number;
  failure_count: number;
  last_alert_at: Date | string | null;
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapTarget(row: TargetRow): Target {
  const lastAt = iso(row.last_ping_at);
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    label: row.label,
    intervalSeconds: Number(row.interval_seconds),
    enabled: Boolean(row.enabled),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    lastPing: lastAt
      ? {
          at: lastAt,
          ok: Boolean(row.last_ping_ok),
          status: row.last_ping_status,
          latencyMs: row.last_ping_latency_ms,
          error: row.last_ping_error,
        }
      : null,
    nextPingAt: iso(row.next_ping_at),
    successCount: Number(row.success_count),
    failureCount: Number(row.failure_count),
    lastAlertAt: iso(row.last_alert_at),
  };
}

export async function listTargetsForUser(userId: string): Promise<Target[]> {
  const database = await db();
  const result = await database.execute({
    sql: "SELECT * FROM targets WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return (result.rows as TargetRow[]).map(mapTarget);
}

export async function getTargetForUser(
  userId: string,
  id: string,
): Promise<Target | null> {
  const database = await db();
  const result = await database.execute({
    sql: "SELECT * FROM targets WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  const row = result.rows[0] as TargetRow | undefined;
  return row ? mapTarget(row) : null;
}

export async function createTargetForUser(
  userId: string,
  input: CreateTargetInput,
): Promise<Target> {
  const url = normalizeUrl(input.url);
  const intervalSeconds = normalizeInterval(input.intervalSeconds);
  const enabled = input.enabled ?? true;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const database = await db();
  await database.execute({
    sql: `INSERT INTO targets (
      id, user_id, url, label, interval_seconds, enabled, created_at, next_ping_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      userId,
      url,
      normalizeLabel(input.label, url),
      intervalSeconds,
      enabled,
      now,
      enabled ? now : null,
    ],
  });

  const created = await getTargetForUser(userId, id);
  if (!created) throw new Error("Failed to create target.");
  return created;
}

export async function updateTargetForUser(
  userId: string,
  id: string,
  input: UpdateTargetInput,
): Promise<Target> {
  const current = await getTargetForUser(userId, id);
  if (!current) throw new Error("Target not found.");

  const url = input.url !== undefined ? normalizeUrl(input.url) : current.url;
  const intervalSeconds =
    input.intervalSeconds !== undefined
      ? normalizeInterval(input.intervalSeconds)
      : current.intervalSeconds;
  const enabled = input.enabled ?? current.enabled;
  const label =
    input.label !== undefined
      ? normalizeLabel(input.label, url)
      : current.label;

  const wasDisabled = !current.enabled;
  const now = new Date().toISOString();
  const nextPingAt = enabled
    ? wasDisabled || input.intervalSeconds !== undefined
      ? now
      : current.nextPingAt
    : null;

  const database = await db();
  await database.execute({
    sql: `UPDATE targets
          SET url = ?, label = ?, interval_seconds = ?, enabled = ?, next_ping_at = ?
          WHERE id = ? AND user_id = ?`,
    args: [url, label, intervalSeconds, enabled, nextPingAt, id, userId],
  });

  const updated = await getTargetForUser(userId, id);
  if (!updated) throw new Error("Target not found.");
  return updated;
}

export async function deleteTargetForUser(userId: string, id: string) {
  const database = await db();
  const result = await database.execute({
    sql: "DELETE FROM targets WHERE id = ? AND user_id = ? RETURNING id",
    args: [id, userId],
  });
  if (!result.rows[0]) throw new Error("Target not found.");
}

export async function listDueTargets(): Promise<Target[]> {
  const database = await db();
  const result = await database.execute({
    sql: `SELECT * FROM targets
          WHERE enabled = TRUE
            AND next_ping_at IS NOT NULL
            AND next_ping_at <= NOW()
          ORDER BY next_ping_at ASC
          LIMIT 50`,
  });
  return (result.rows as TargetRow[]).map(mapTarget);
}

const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

export async function recordPingResult(
  target: Target,
  result: {
    ok: boolean;
    status: number | null;
    latencyMs: number | null;
    error: string | null;
  },
): Promise<{ shouldAlert: boolean }> {
  const database = await db();
  const at = new Date().toISOString();
  const nextPingAt = new Date(
    Date.now() + target.intervalSeconds * 1000,
  ).toISOString();
  const eventId = crypto.randomUUID();

  const previouslyOk = target.lastPing?.ok !== false;
  const cooldownReady =
    !target.lastAlertAt ||
    Date.now() - new Date(target.lastAlertAt).getTime() >= ALERT_COOLDOWN_MS;
  const shouldAlert = !result.ok && previouslyOk && cooldownReady;

  await database.batch([
    {
      sql: `UPDATE targets SET
        last_ping_at = ?,
        last_ping_ok = ?,
        last_ping_status = ?,
        last_ping_latency_ms = ?,
        last_ping_error = ?,
        next_ping_at = ?,
        success_count = success_count + ?,
        failure_count = failure_count + ?,
        last_alert_at = CASE WHEN ? THEN ? ELSE last_alert_at END
      WHERE id = ?`,
      args: [
        at,
        result.ok,
        result.status,
        result.latencyMs,
        result.error,
        nextPingAt,
        result.ok ? 1 : 0,
        result.ok ? 0 : 1,
        shouldAlert,
        at,
        target.id,
      ],
    },
    {
      sql: `INSERT INTO ping_events (
        id, target_id, user_id, ok, status, latency_ms, error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        eventId,
        target.id,
        target.userId,
        result.ok,
        result.status,
        result.latencyMs,
        result.error,
        at,
      ],
    },
  ]);

  return { shouldAlert };
}

export async function listRecentForUser(
  userId: string,
  limit = 40,
): Promise<RecentEvent[]> {
  const database = await db();
  const result = await database.execute({
    sql: `SELECT e.id, e.target_id, e.ok, e.status, e.latency_ms, e.error, e.created_at,
                 t.label, t.url
          FROM ping_events e
          JOIN targets t ON t.id = e.target_id
          WHERE e.user_id = ?
          ORDER BY e.created_at DESC
          LIMIT ?`,
    args: [userId, limit],
  });

  return (
    result.rows as Array<{
      id: string;
      target_id: string;
      label: string;
      url: string;
      ok: boolean;
      status: number | null;
      latency_ms: number | null;
      error: string | null;
      created_at: Date | string;
    }>
  ).map((row) => ({
    id: row.id,
    targetId: row.target_id,
    label: row.label,
    url: row.url,
    result: {
      at: iso(row.created_at) ?? new Date().toISOString(),
      ok: Boolean(row.ok),
      status: row.status,
      latencyMs: row.latency_ms,
      error: row.error,
    },
  }));
}

export async function getStatsForUser(userId: string): Promise<StatsPayload> {
  const database = await db();

  // Single bounded query — avoids a second aggregation round-trip on cold pools.
  const recent = await database.execute({
    sql: `SELECT created_at, ok, latency_ms
          FROM ping_events
          WHERE user_id = ?
            AND created_at >= NOW() - INTERVAL '24 hours'
          ORDER BY created_at ASC
          LIMIT 120`,
    args: [userId],
  });

  const recentRows = recent.rows as Array<{
    created_at: Date | string;
    ok: boolean;
    latency_ms: number | null;
  }>;

  let points: StatsPayload["points"] = [];

  if (recentRows.length === 0) {
    points = [];
  } else if (recentRows.length < 24) {
    points = recentRows.map((row) => ({
      date: iso(row.created_at) ?? new Date().toISOString(),
      pings: 1,
      successes: row.ok ? 1 : 0,
      failures: row.ok ? 0 : 1,
      latency: Math.round(Number(row.latency_ms ?? 0)),
    }));
  } else {
    const buckets = new Map<
      string,
      { pings: number; successes: number; failures: number; latencySum: number; latencyCount: number }
    >();
    for (const row of recentRows) {
      const at = new Date(row.created_at);
      at.setMinutes(0, 0, 0);
      const key = at.toISOString();
      const bucket = buckets.get(key) ?? {
        pings: 0,
        successes: 0,
        failures: 0,
        latencySum: 0,
        latencyCount: 0,
      };
      bucket.pings += 1;
      if (row.ok) bucket.successes += 1;
      else bucket.failures += 1;
      if (row.latency_ms != null) {
        bucket.latencySum += Number(row.latency_ms);
        bucket.latencyCount += 1;
      }
      buckets.set(key, bucket);
    }
    points = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => ({
        date,
        pings: bucket.pings,
        successes: bucket.successes,
        failures: bucket.failures,
        latency:
          bucket.latencyCount === 0
            ? 0
            : Math.round(bucket.latencySum / bucket.latencyCount),
      }));
  }

  // Ensure the chart always has at least two x points so the area path draws.
  if (points.length === 1) {
    const only = points[0];
    const earlier = new Date(new Date(only.date).getTime() - 60_000).toISOString();
    points = [
      {
        date: earlier,
        pings: 0,
        successes: 0,
        failures: 0,
        latency: only.latency,
      },
      only,
    ];
  }

  const totalPings = points.reduce((sum, p) => sum + p.pings, 0);
  const successes = points.reduce((sum, p) => sum + p.successes, 0);
  const latencySamples = points.filter((p) => p.pings > 0);
  const latencySum = latencySamples.reduce(
    (sum, p) => sum + p.latency * p.pings,
    0,
  );

  return {
    points,
    totalPings,
    successRate: totalPings === 0 ? 0 : Math.round((successes / totalPings) * 100),
    avgLatency:
      totalPings === 0 ? 0 : Math.round(latencySum / totalPings),
  };
}

export async function countTargets() {
  const database = await db();
  const result = await database.execute(
    "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE enabled)::int AS enabled FROM targets",
  );
  const row = result.rows[0] as { total: number; enabled: number } | undefined;
  return {
    total: Number(row?.total ?? 0),
    enabled: Number(row?.enabled ?? 0),
  };
}
