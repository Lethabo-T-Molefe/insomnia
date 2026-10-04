export type PingResult = {
  at: string;
  ok: boolean;
  status: number | null;
  latencyMs: number | null;
  error: string | null;
};

export type Target = {
  id: string;
  userId: string;
  url: string;
  label: string;
  intervalSeconds: number;
  enabled: boolean;
  createdAt: string;
  lastPing: PingResult | null;
  nextPingAt: string | null;
  successCount: number;
  failureCount: number;
  lastAlertAt: string | null;
};

export type CreateTargetInput = {
  url: string;
  label?: string;
  intervalSeconds: number;
  enabled?: boolean;
};

export type UpdateTargetInput = {
  url?: string;
  label?: string;
  intervalSeconds?: number;
  enabled?: boolean;
};

export type RecentEvent = {
  id: string;
  targetId: string;
  label: string;
  url: string;
  result: PingResult;
};

export type EngineStatus = {
  running: boolean;
  startedAt: string | null;
  targetCount: number;
  enabledCount: number;
  targets: Target[];
  recent: RecentEvent[];
};

export type StatsPoint = {
  date: string;
  latency: number;
  pings: number;
  successes: number;
  failures: number;
};

export type StatsPayload = {
  points: StatsPoint[];
  successRate: number;
  totalPings: number;
  avgLatency: number;
};
