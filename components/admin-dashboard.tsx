"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { motion } from "motion/react";
import { Brand } from "@/components/brand";
import { StatsCharts } from "@/components/stats-charts";
import type { StatsPayload } from "@/lib/types";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  createdAt: string;
  targetCount: number;
  pingCount: number;
  successCount: number;
  avgLatency: number;
};

type Overview = {
  users: number;
  admins: number;
  targets: number;
  enabledTargets: number;
  pings24h: number;
  successRate24h: number;
  avgLatency24h: number;
};

type AuditEvent = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
};

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString();
}

export function AdminDashboard({
  initialUser,
}: {
  initialUser: { id: string; email: string; name: string; role: string };
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [usersRes, analyticsRes, auditRes] = await Promise.all([
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/analytics", { cache: "no-store" }),
      fetch("/api/admin/audit?limit=80", { cache: "no-store" }),
    ]);

    if (!usersRes.ok || !analyticsRes.ok || !auditRes.ok) {
      const payload = (await usersRes.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Could not load admin data.");
      setLoading(false);
      return;
    }

    const usersData = (await usersRes.json()) as { users: AdminUser[] };
    const analyticsData = (await analyticsRes.json()) as {
      overview: Overview;
      stats: StatsPayload;
    };
    const auditData = (await auditRes.json()) as { events: AuditEvent[] };

    setUsers(usersData.users);
    setOverview(analyticsData.overview);
    setStats(analyticsData.stats);
    setAudit(auditData.events);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 5_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function changeRole(userId: string, role: "user" | "admin") {
    setBusyId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update role.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update role.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_15%_0%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_55%)]"
      />

      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <Brand size="sm" href="/app" className="mb-4" />
          <p className="label-mono text-muted-foreground">Admin</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
            System control
          </h1>
          <p className="mt-2 max-w-xl font-mono text-sm text-muted-foreground">
            Manage users, review analytics, and audit changes across Insomnia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/app"
            className="rounded-md border border-border px-3 py-2 font-mono text-xs hover:bg-secondary"
          >
            Back to app
          </Link>
          <span className="font-mono text-xs text-muted-foreground">
            {initialUser.email}
          </span>
          <UserButton />
        </div>
      </motion.header>

      {error ? (
        <p className="relative z-10 mb-4 font-mono text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="relative z-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Users", overview?.users],
          ["Admins", overview?.admins],
          ["Targets", overview?.targets],
          ["Pings 24h", overview?.pings24h],
          ["Enabled", overview?.enabledTargets],
          ["Success 24h", overview ? `${overview.successRate24h}%` : null],
          ["Avg latency", overview ? `${overview.avgLatency24h}ms` : null],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="surface-card rounded-[var(--radius)] p-4"
          >
            <p className="label-mono text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold">
              {loading && value == null ? "…" : (value ?? "—")}
            </p>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-4">
        <StatsCharts stats={stats} loading={loading} />
      </div>

      <div className="relative z-10 mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="surface-card rounded-[var(--radius)] p-5">
          <p className="label-mono text-muted-foreground">Directory</p>
          <h2 className="mt-1 text-xl font-bold">Users</h2>
          <div className="mt-4 max-h-[28rem] overflow-y-auto pr-1">
            <ul className="divide-y divide-border">
              {users.map((user) => {
                const busy = busyId === user.id;
                return (
                  <li key={user.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="truncate">{user.name}</strong>
                          <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                            {user.role}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {user.email}
                        </p>
                        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                          {user.targetCount} targets · {user.pingCount} pings ·{" "}
                          {user.avgLatency}ms avg
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {user.role === "admin" ? (
                          <button
                            type="button"
                            disabled={busy || user.id === initialUser.id}
                            onClick={() => void changeRole(user.id, "user")}
                            className="rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] hover:bg-secondary disabled:opacity-50"
                          >
                            Make user
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void changeRole(user.id, "admin")}
                            className="rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] hover:bg-secondary disabled:opacity-50"
                          >
                            Make admin
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="surface-card flex max-h-[34rem] flex-col rounded-[var(--radius)] p-5">
          <p className="label-mono text-muted-foreground">Audit</p>
          <h2 className="mt-1 text-xl font-bold">Recent system events</h2>
          <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {audit.length === 0 ? (
              <li className="font-mono text-xs text-muted-foreground">
                No audit events yet.
              </li>
            ) : (
              audit.map((event) => (
                <li key={event.id} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                  <div className="min-w-0">
                    <strong className="text-sm">{event.action}</strong>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {formatAgo(event.createdAt)}
                      {event.actorEmail ? ` · ${event.actorEmail}` : ""}
                      {event.entityType ? ` · ${event.entityType}` : ""}
                      {event.entityId ? ` · ${event.entityId.slice(0, 8)}` : ""}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
