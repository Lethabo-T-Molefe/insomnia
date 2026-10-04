"use client";

import { Area, AreaChart } from "@/components/charts/area-chart";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { RingChart } from "@/components/charts/ring-chart";
import { RingCenter } from "@/components/charts/ring-center";
import type { StatsPayload } from "@/lib/types";

export function StatsCharts({
  stats,
  loading,
}: {
  stats: StatsPayload | null;
  loading: boolean;
}) {
  const points = stats?.points ?? [];
  const hasData = points.some((point) => point.pings > 0 || point.latency > 0);
  const chartData = hasData
    ? points.map((point) => ({
        date: point.date,
        latency: point.latency,
        pings: point.pings,
      }))
    : [];

  const successRate = stats?.successRate ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="surface-card rounded-[var(--radius)] p-4">
        <p className="label-mono text-muted-foreground">Latency · 24h</p>
        <h3 className="mt-1 text-lg font-bold">Response time</h3>
        <div className="relative mt-3 h-56 w-full">
          {hasData ? (
            <AreaChart
              data={chartData}
              xDataKey="date"
              status={loading ? "loading" : "ready"}
              loadingLabel="Loading latency"
              className="h-full w-full"
              margin={{ top: 16, right: 16, bottom: 28, left: 8 }}
            >
              <Grid horizontal />
              <Area
                dataKey="latency"
                fill="var(--chart-line-primary)"
                stroke="var(--chart-line-primary)"
                fillOpacity={0.35}
                strokeWidth={3}
                showMarkers
              />
              <XAxis />
              <ChartTooltip />
            </AreaChart>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border px-6 text-center">
              <p className="font-mono text-xs text-muted-foreground">
                {loading
                  ? "Loading latency…"
                  : "No ping data yet. Add a URL and wait for the first keep-alive."}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="surface-card rounded-[var(--radius)] p-4">
        <p className="label-mono text-muted-foreground">Reliability</p>
        <h3 className="mt-1 text-lg font-bold">Success rate</h3>
        <div className="mx-auto mt-2 h-52 w-52">
          <RingChart
            data={[
              {
                label: "Success",
                value: successRate,
                maxValue: 100,
                color: "var(--chart-line-primary)",
              },
            ]}
            strokeWidth={14}
          >
            <RingCenter defaultLabel="Success" suffix="%" />
          </RingChart>
        </div>
        <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
          {stats?.totalPings ?? 0} pings · avg {stats?.avgLatency ?? 0}ms
        </p>
      </div>
    </div>
  );
}
