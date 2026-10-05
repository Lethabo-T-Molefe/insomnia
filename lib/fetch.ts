export function friendlyNetworkError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Request timed out. If the app was idle, the server may be waking up — retry in a few seconds.";
  }
  if (error instanceof TypeError) {
    return "Cannot reach the server. Check your internet, DNS, or wait if the host is waking from sleep.";
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Network error. Connection dropped or the domain could not be resolved.";
    }
    return error.message;
  }
  return "Request failed.";
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const { timeoutMs = 12_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...rest,
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as T | null;
    if (!response.ok) {
      const message =
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : `Request failed (${response.status})`;
      return { ok: false, status: response.status, data, error: message };
    }
    return { ok: true, status: response.status, data, error: null };
  } catch (error) {
    const message = friendlyNetworkError(error);
    return { ok: false, status: 0, data: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}
