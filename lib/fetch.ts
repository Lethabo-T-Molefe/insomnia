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
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out. Check your connection and try again."
        : error instanceof Error
          ? error.message
          : "Request failed.";
    return { ok: false, status: 0, data: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}
