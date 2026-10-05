"use client";

import { useEffect, useRef } from "react";

type PollOptions = {
  /** Initial and steady-state interval when requests succeed (ms). */
  intervalMs?: number;
  /** How often to run with `includeStats` true (ms). */
  statsIntervalMs?: number;
  /** Max backoff after repeated failures (ms). */
  maxBackoffMs?: number;
};

/**
 * Schedules polling with single-flight, offline/visibility pause, and exponential backoff on errors.
 */
export function useSmartPoll(
  poll: (includeStats: boolean) => Promise<boolean>,
  options: PollOptions = {},
) {
  const pollRef = useRef(poll);
  pollRef.current = poll;

  const {
    intervalMs = 15_000,
    statsIntervalMs = 45_000,
    maxBackoffMs = 60_000,
  } = options;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let inFlight = false;
    let failStreak = 0;
    let nextStatsAt = Date.now();

    const schedule = (delayMs: number, includeStats: boolean) => {
      if (cancelled) return;
      timer = setTimeout(() => {
        void run(includeStats);
      }, delayMs);
    };

    const run = async (forceStats = false) => {
      if (cancelled || inFlight) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        schedule(Math.min(intervalMs * 2, maxBackoffMs), forceStats);
        return;
      }

      if (typeof document !== "undefined" && document.hidden) {
        schedule(intervalMs, false);
        return;
      }

      const includeStats = forceStats || Date.now() >= nextStatsAt;
      inFlight = true;
      let ok = false;
      try {
        ok = await pollRef.current(includeStats);
      } finally {
        inFlight = false;
      }

      if (cancelled) return;

      if (ok) {
        failStreak = 0;
        if (includeStats) {
          nextStatsAt = Date.now() + statsIntervalMs;
        }
        schedule(intervalMs, false);
        return;
      }

      failStreak += 1;
      const backoff = Math.min(
        maxBackoffMs,
        intervalMs * 2 ** Math.min(failStreak, 4),
      );
      schedule(backoff, includeStats);
    };

    void run(true);

    const onOnline = () => {
      failStreak = 0;
      void run(true);
    };
    const onVisible = () => {
      if (!document.hidden) void run(false);
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, statsIntervalMs, maxBackoffMs]);
}
