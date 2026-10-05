import { getHealthUrl } from "@/lib/app-url";
import {
  getTargetForUser,
  listDueTargets,
  recordPingResult,
} from "@/lib/targets";
import type { Target } from "@/lib/types";

const TICK_MS = 1_000;
const REQUEST_TIMEOUT_MS = 15_000;
/** Ping our own /api/health often enough to stop free hosts from sleeping. */
const SELF_KEEPALIVE_MS = Math.max(
  45_000,
  Number(process.env.SELF_KEEPALIVE_SECONDS ?? 600) * 1000 || 600_000,
);

declare global {
  // eslint-disable-next-line no-var
  var __insomniaEngine: PingEngine | undefined;
}

class PingEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt: string | null = null;
  private ticking = false;
  private lastSelfPingAt = 0;

  start() {
    if (this.timer) return;
    this.startedAt = new Date().toISOString();
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    // Immediate kick so cold boots don't wait a full interval.
    void this.tick();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  isRunning() {
    return Boolean(this.timer);
  }

  getStartedAt() {
    return this.startedAt;
  }

  async pingNow(userId: string, id: string): Promise<Target> {
    const target = await getTargetForUser(userId, id);
    if (!target) throw new Error("Target not found.");
    await this.pingTarget(target);
    const updated = await getTargetForUser(userId, id);
    if (!updated) throw new Error("Target not found.");
    return updated;
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.selfKeepAlive();

      if (!process.env.DATABASE_URL) return;
      const due = await listDueTargets();
      for (const target of due) {
        await this.pingTarget(target);
      }
    } catch (error) {
      console.error("[insomnia] ping tick failed", error);
    } finally {
      this.ticking = false;
    }
  }

  /**
   * Hits this app's public health URL so the host receives inbound traffic
   * and stays awake — independent of whether any browser is open.
   */
  private async selfKeepAlive() {
    const healthUrl = getHealthUrl();
    if (!healthUrl) return;

    const now = Date.now();
    if (now - this.lastSelfPingAt < SELF_KEEPALIVE_MS) return;
    this.lastSelfPingAt = now;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch(healthUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "Insomnia-SelfKeepAlive/1.0",
          Accept: "application/json",
        },
      });
      clearTimeout(timeout);
      await response.arrayBuffer().catch(() => undefined);
    } catch (error) {
      console.warn(
        "[insomnia] self keep-alive failed",
        error instanceof Error ? error.message : error,
      );
    }
  }

  private async pingTarget(target: Target) {
    const started = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(target.url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent": "Insomnia-KeepAlive/1.0",
          Accept: "*/*",
        },
      });

      clearTimeout(timeout);
      await response.arrayBuffer().catch(() => undefined);

      await recordPingResult(target, {
        ok: true,
        status: response.status,
        latencyMs: Date.now() - started,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? "Request timed out."
            : error.message
          : "Request failed.";

      await recordPingResult(target, {
        ok: false,
        status: null,
        latencyMs: Date.now() - started,
        error: message,
      });
    }
  }
}

export function getPingEngine(): PingEngine {
  const existing = globalThis.__insomniaEngine;
  if (!existing || typeof existing.isRunning !== "function") {
    globalThis.__insomniaEngine = new PingEngine();
  }

  const engine = globalThis.__insomniaEngine!;
  if (!engine.isRunning()) {
    engine.start();
  }
  return engine;
}
