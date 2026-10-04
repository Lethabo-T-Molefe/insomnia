"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "motion/react";
import { Brand } from "@/components/brand";
import { StatsCharts } from "@/components/stats-charts";
import { fetchJson } from "@/lib/fetch";
import type { RecentEvent, StatsPayload, Target } from "@/lib/types";

type DashboardUser = {
  id: string;
  email: string;
  name: string;
  role?: "user" | "admin";
};

type StatusPayload = {
  running: boolean;
  startedAt: string | null;
  targetCount: number;
  enabledCount: number;
  targets: Target[];
  recent: RecentEvent[];
  user: DashboardUser;
};

function formatAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 1_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return new Date(iso).toLocaleTimeString();
}

function formatCountdown(iso: string | null, enabled: boolean): string {
  if (!enabled) return "paused";
  if (!iso) return "queued";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "due";
  if (ms < 60_000) return `in ${Math.ceil(ms / 1000)}s`;
  return `in ${Math.ceil(ms / 60_000)}m`;
}

type DashboardPayload = StatusPayload & {
  stats: StatsPayload | null;
};

export function Dashboard({
  initialUser,
}: {
  initialUser: DashboardUser;
}) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(45);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const refresh = useCallback(async (includeStats = false) => {
    const result = await fetchJson<DashboardPayload>(
      includeStats ? "/api/dashboard" : "/api/dashboard?stats=0",
      { cache: "no-store", timeoutMs: 12_000 },
    );

    if (result.ok && result.data) {
      setStatus(result.data);
      setLoadError(null);
      if (includeStats) {
        if (result.data.stats) setStats(result.data.stats);
        setStatsLoading(false);
      }
      return;
    }

    if (result.status === 401) {
      router.replace("/login");
      return;
    }

    console.error("[dashboard] refresh failed", result.error);
    setLoadError(result.error ?? "Could not load dashboard.");
    if (includeStats) setStatsLoading(false);
  }, [router]);

  useEffect(() => {
    void refresh(true);
    const statusTimer = setInterval(() => {
      void refresh(false);
    }, 8_000);
    const statsTimer = setInterval(() => {
      void refresh(true);
    }, 30_000);
    return () => {
      clearInterval(statusTimer);
      clearInterval(statsTimer);
    };
  }, [refresh]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await fetchJson<{ error?: string; target?: Target }>(
        "/api/targets",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            label: label.trim() || undefined,
            intervalSeconds,
          }),
          timeoutMs: 15_000,
        },
      );
      if (!result.ok || !result.data?.target) {
        throw new Error(result.error ?? "Could not add target.");
      }
      const created = result.data.target;
      setStatus((prev) => {
        const base =
          prev ??
          ({
            running: true,
            startedAt: null,
            targetCount: 0,
            enabledCount: 0,
            targets: [],
            recent: [],
            user: initialUser,
          } satisfies StatusPayload);
        const targets = [
          created,
          ...base.targets.filter((item) => item.id !== created.id),
        ];
        return {
          ...base,
          targets,
          targetCount: targets.length,
          enabledCount: targets.filter((item) => item.enabled).length,
        };
      });
      setUrl("");
      setLabel("");
      // Never block the button on a slow dashboard refresh.
      void refresh(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add target.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEnabled(target: Target) {
    setBusyId(target.id);
    try {
      await fetchJson(`/api/targets/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !target.enabled }),
        timeoutMs: 12_000,
      });
      void refresh(false);
    } finally {
      setBusyId(null);
    }
  }

  async function pingNow(id: string) {
    setBusyId(id);
    try {
      await fetchJson(`/api/targets/${id}/ping`, {
        method: "POST",
        timeoutMs: 20_000,
      });
      void refresh(false);
    } finally {
      setBusyId(null);
    }
  }

  async function removeTarget(id: string) {
    setBusyId(id);
    try {
      await fetchJson(`/api/targets/${id}`, {
        method: "DELETE",
        timeoutMs: 12_000,
      });
      setStatus((prev) => {
        if (!prev) return prev;
        const targets = prev.targets.filter((item) => item.id !== id);
        return {
          ...prev,
          targets,
          targetCount: targets.length,
          enabledCount: targets.filter((item) => item.enabled).length,
        };
      });
      void refresh(false);
    } finally {
      setBusyId(null);
    }
  }

  const targets = status?.targets ?? [];
  const recent = status?.recent ?? [];
  const user = status?.user ?? initialUser;
  const displayName =
    user.name ||
    clerkUser?.fullName ||
    clerkUser?.firstName ||
    clerkUser?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "there";
  const isAdmin =
    user.role === "admin" ||
    status?.user?.role === "admin";

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_15%_0%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_55%),radial-gradient(ellipse_50%_40%_at_90%_8%,color-mix(in_oklab,var(--accent)_12%,transparent),transparent_50%)]"
      />

      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <Brand size="lg" href="/app" className="mb-4" />
          <p className="label-mono text-muted-foreground">Insomnia</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Keep awake
          </h1>
          <p className="mt-2 max-w-xl font-mono text-sm text-muted-foreground">
            Hello {displayName}. Your URLs stay yours — pinged on your schedule.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="surface-card inline-flex items-center gap-2 rounded-full px-3 py-2 font-mono text-xs"
            data-running={status?.running ?? false}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status?.running
                  ? "bg-primary animate-pulse-soft"
                  : "bg-muted-foreground"
              }`}
            />
            {status?.running
              ? "Watcher live"
              : loadError
                ? "Retry needed"
                : status
                  ? "Starting…"
                  : "Loading…"}
            <span className="text-muted-foreground">
              {status?.enabledCount ?? 0}/{status?.targetCount ?? 0}
            </span>
          </div>
          {loadError ? (
            <button
              type="button"
              onClick={() => void refresh(true)}
              className="rounded-md border border-border px-3 py-2 font-mono text-xs hover:bg-secondary"
            >
              Retry load
            </button>
          ) : null}
          {isAdmin ? (
            <Link
              href="/admin"
              className="rounded-md border border-border px-3 py-2 font-mono text-xs hover:bg-secondary"
            >
              Admin
            </Link>
          ) : null}
          <UserButton />
        </div>
      </motion.header>

      <div className="relative z-10 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.45 }}
          className="surface-card rounded-[var(--radius)] p-5"
        >
          <p className="label-mono text-muted-foreground">New target</p>
          <h2 className="mt-1 text-xl font-bold">Add a URL</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Ping every X seconds so free hosts do not sleep.
          </p>

          {loadError ? (
            <p className="mt-3 font-mono text-xs text-destructive">{loadError}</p>
          ) : null}

          <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
            <label className="grid gap-1.5">
              <span className="label-mono text-muted-foreground">Service URL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://my-api.onrender.com/health"
                required
                className="rounded-md border border-input bg-deep/50 px-3 py-2.5 outline-none focus:border-ring"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-[1.3fr_0.8fr]">
              <label className="grid gap-1.5">
                <span className="label-mono text-muted-foreground">Label</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="API staging"
                  className="rounded-md border border-input bg-deep/50 px-3 py-2.5 outline-none focus:border-ring"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="label-mono text-muted-foreground">
                  Interval (sec)
                </span>
                <input
                  type="number"
                  min={45}
                  max={86400}
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                  required
                  className="rounded-md border border-input bg-deep/50 px-3 py-2.5 outline-none focus:border-ring"
                />
              </label>
            </div>

            {error ? (
              <p className="font-mono text-sm text-destructive">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="justify-self-start rounded-md bg-primary px-4 py-2.5 font-bold text-primary-foreground transition hover:-translate-y-px disabled:opacity-60"
            >
              {submitting ? "Adding…" : "Keep this URL awake"}
            </button>
          </form>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45 }}
          className="surface-card rounded-[var(--radius)] p-5"
        >
          <p className="label-mono text-muted-foreground">Your watch list</p>
          <h2 className="mt-1 text-xl font-bold">
            {targets.length === 0
              ? "No targets yet"
              : `${targets.length} URL${targets.length === 1 ? "" : "s"}`}
          </h2>

          <ul className="mt-4 divide-y divide-border">
            <AnimatePresence initial={false}>
              {targets.map((target, index) => {
                const busy = busyId === target.id;
                return (
                  <motion.li
                    key={target.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`py-4 ${target.enabled ? "" : "opacity-60"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="truncate">{target.label}</strong>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              !target.lastPing
                                ? "bg-accent"
                                : target.lastPing.ok
                                  ? "bg-primary"
                                  : "bg-destructive"
                            }`}
                          />
                        </div>
                        <a
                          href={target.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate font-mono text-xs text-muted-foreground hover:text-primary"
                        >
                          {target.url}
                        </a>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                          <span>every {target.intervalSeconds}s</span>
                          <span>last {formatAgo(target.lastPing?.at ?? null)}</span>
                          <span>
                            next{" "}
                            {formatCountdown(target.nextPingAt, target.enabled)}
                          </span>
                          {target.lastPing?.latencyMs != null ? (
                            <span>{target.lastPing.latencyMs}ms</span>
                          ) : null}
                          {target.lastPing?.error ? (
                            <span className="text-destructive">
                              {target.lastPing.error}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void pingNow(target.id)}
                        className="rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] hover:bg-secondary disabled:opacity-50"
                      >
                        Ping now
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleEnabled(target)}
                        className="rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] hover:bg-secondary disabled:opacity-50"
                      >
                        {target.enabled ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeTarget(target.id)}
                        className="rounded-md border border-destructive/40 px-2.5 py-1.5 font-mono text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </motion.section>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.45 }}
        className="relative z-10 mt-4"
      >
        <StatsCharts stats={stats} loading={statsLoading} />
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45 }}
        className="surface-card relative z-10 mt-4 flex max-h-[min(28rem,55vh)] flex-col rounded-[var(--radius)] p-5"
      >
        <p className="label-mono text-muted-foreground">Activity</p>
        <h2 className="mt-1 shrink-0 text-xl font-bold">Recent pings</h2>
        <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
          {recent.length === 0 ? (
            <li className="font-mono text-xs text-muted-foreground">
              No pings yet.
            </li>
          ) : (
            recent.map((event) => (
              <li key={event.id} className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    event.result.ok ? "bg-primary" : "bg-destructive"
                  }`}
                />
                <div className="min-w-0">
                  <strong className="text-sm">{event.label}</strong>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {formatAgo(event.result.at)}
                    {event.result.latencyMs != null
                      ? ` · ${event.result.latencyMs}ms`
                      : ""}
                    {event.result.status != null
                      ? ` · HTTP ${event.result.status}`
                      : ""}
                    {event.result.error ? ` · ${event.result.error}` : ""}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </motion.section>

      <p className="relative z-10 mt-6 max-w-2xl font-mono text-xs text-muted-foreground">
        Keep Insomnia running on this machine (or an always-on host). If this
        app sleeps, it cannot wake your other services.
      </p>
    </div>
  );
}
