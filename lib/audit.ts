import "server-only";
import { db } from "@/lib/db";

export async function writeAuditEvent(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  const database = await db();
  await database.execute({
    sql: `INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, meta)
          VALUES (?, ?, ?, ?, ?, ?::jsonb)`,
    args: [
      crypto.randomUUID(),
      input.actorId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  });
}

export async function listAuditEvents(limit = 100) {
  const database = await db();
  const result = await database.execute({
    sql: `SELECT a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.meta, a.created_at,
                 u.email AS actor_email, u.name AS actor_name
          FROM audit_events a
          LEFT JOIN users u ON u.id = a.actor_id
          ORDER BY a.created_at DESC
          LIMIT ?`,
    args: [limit],
  });

  return (
    result.rows as Array<{
      id: string;
      actor_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      meta: Record<string, unknown> | string;
      created_at: Date | string;
      actor_email: string | null;
      actor_name: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    meta:
      typeof row.meta === "string"
        ? (JSON.parse(row.meta) as Record<string, unknown>)
        : row.meta,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  }));
}
