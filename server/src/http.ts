/**
 * Small shared HTTP helper for the GitHub and Notion clients. Adds a request
 * timeout, defensive JSON parsing (empty / non-JSON 2xx bodies don't crash the
 * caller) and a typed error that carries the HTTP status so callers can tell
 * "404 not found" apart from a transient failure.
 */

const DEFAULT_TIMEOUT_MS = 15000;

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

/** Fetch + parse JSON with a timeout, an ok-check and a clear, status-bearing error. */
export async function jsonFetch<T = unknown>(
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const e = err as Error;
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      throw new Error(`${label}: timeout dopo ${Math.round(timeoutMs / 1000)}s`);
    }
    throw new Error(`${label}: ${e.message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(res.status, `${label} ${res.status}: ${text.slice(0, 200)}`);
  }
  // Some endpoints (DELETE, some PATCH) legitimately return an empty body.
  const body = await res.text();
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`${label}: risposta non-JSON (HTTP ${res.status})`);
  }
}
