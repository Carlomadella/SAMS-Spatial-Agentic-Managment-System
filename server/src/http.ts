/**
 * Small shared HTTP helper for the GitHub and Notion clients. Adds a request
 * timeout, retry-with-backoff for transient failures on *idempotent* methods
 * (never on POST/PATCH/PUT — those could double-write), defensive JSON parsing
 * (empty / non-JSON 2xx bodies don't crash the caller) and a typed error that
 * carries the HTTP status so callers can tell "404 not found" apart from a
 * transient failure.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_BASE_MS = 400;
const RETRY_MAX_MS = 30000;

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Delay before the next attempt — honor `Retry-After` (seconds), else exp backoff. */
function backoffMs(res: Response | null, attempt: number): number {
  const ra = res?.headers.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, RETRY_MAX_MS);
  }
  return Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
}

/**
 * Fetch + parse JSON with a timeout, an ok-check and a clear, status-bearing error.
 * GET/HEAD are retried on 429/5xx and network errors; other methods are not
 * (a retried POST could create a duplicate issue/PR). Override with `opts.retries`.
 */
export async function jsonFetch<T = unknown>(
  url: string,
  init: RequestInit,
  label: string,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const idempotent = method === "GET" || method === "HEAD";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? (idempotent ? 2 : 0);

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      const e = err as Error;
      if (attempt < retries) {
        await sleep(backoffMs(null, attempt));
        continue;
      }
      const msg =
        e.name === "TimeoutError" || e.name === "AbortError"
          ? `${label}: timeout dopo ${Math.round(timeoutMs / 1000)}s`
          : `${label}: ${e.message}`;
      throw new Error(msg, { cause: err });
    }

    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(backoffMs(res, attempt));
        continue;
      }
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
}
