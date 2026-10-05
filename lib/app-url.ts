/**
 * Public base URL for this deployment (used for self keep-alive).
 */
export function getAppBaseUrl(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(
        trimmed.includes("://") ? trimmed : `https://${trimmed}`,
      );
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

export function getHealthUrl(): string | null {
  const base = getAppBaseUrl();
  return base ? `${base}/api/health` : null;
}

export function getAppWatchUrl(): string | null {
  return getHealthUrl() ?? getAppBaseUrl();
}
