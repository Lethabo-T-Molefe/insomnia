export default function AppLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_15%_0%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_55%)]"
      />
      <div className="relative z-10 space-y-4">
        <div className="h-10 w-28 animate-pulse rounded-md bg-secondary/80" />
        <div className="h-12 w-64 animate-pulse rounded-md bg-secondary/80" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-secondary/60" />
        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          <div className="surface-card h-64 animate-pulse rounded-[var(--radius)]" />
          <div className="surface-card h-64 animate-pulse rounded-[var(--radius)]" />
        </div>
      </div>
    </div>
  );
}
