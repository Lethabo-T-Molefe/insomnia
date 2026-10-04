const MIN_INTERVAL_SECONDS = 45;
const MAX_INTERVAL_SECONDS = 60 * 60 * 24;

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Enter a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  return parsed.toString();
}

export function normalizeInterval(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    throw new Error("Interval must be a number.");
  }

  const value = Math.floor(seconds);
  if (value < MIN_INTERVAL_SECONDS) {
    throw new Error(`Interval must be at least ${MIN_INTERVAL_SECONDS} seconds.`);
  }
  if (value > MAX_INTERVAL_SECONDS) {
    throw new Error(`Interval must be at most ${MAX_INTERVAL_SECONDS} seconds.`);
  }
  return value;
}

export function normalizeLabel(label: string | undefined, url: string): string {
  const trimmed = label?.trim();
  if (trimmed) return trimmed;
  try {
    return new URL(url).hostname;
  } catch {
    return "Untitled target";
  }
}

export { MIN_INTERVAL_SECONDS, MAX_INTERVAL_SECONDS };
