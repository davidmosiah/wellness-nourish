/// <reference types="node" />

/**
 * Resilient `fetch()` wrapper for outbound provider calls.
 *
 * The bare `fetch()` in `src/providers/*.ts` had no timeout, so a slow USDA
 * or Open Food Facts response could pin the MCP server until the client gave
 * up — which is the largest robustness gap flagged by the QA report. This
 * helper centralizes timeout, single-retry-with-backoff, and a structured
 * `NourishHttpError` so call-sites can decide whether to surface a hard
 * error or degrade gracefully (return `[]` + warning).
 *
 * Usage:
 *   try {
 *     const res = await fetchWithTimeout(url, { headers });
 *     // res.ok guaranteed; throw otherwise (already handled below)
 *     return (await res.json()) as T;
 *   } catch (err) {
 *     if (err instanceof NourishHttpError && err.transient) {
 *       // degraded path
 *     }
 *     throw err;
 *   }
 */
import { getConfig } from "./config.js";

export type NourishHttpErrorKind =
  | "timeout"
  | "rate_limit"
  | "server_error"
  | "network"
  | "http";

export class NourishHttpError extends Error {
  readonly kind: NourishHttpErrorKind;
  readonly status?: number;
  readonly url: string;
  readonly attempts: number;
  /** True for kinds that callers may safely treat as a degraded result. */
  readonly transient: boolean;

  constructor(input: {
    kind: NourishHttpErrorKind;
    message: string;
    url: string;
    status?: number;
    attempts: number;
  }) {
    super(input.message);
    this.name = "NourishHttpError";
    this.kind = input.kind;
    this.url = input.url;
    this.attempts = input.attempts;
    if (input.status !== undefined) {
      this.status = input.status;
    }
    this.transient = input.kind !== "http";
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Per-attempt timeout in ms. Defaults to config provider_timeout_ms. */
  timeoutMs?: number;
  /** Retry count on transient errors (network/timeout/5xx/429). Defaults to 1. */
  retries?: number;
  /** Base backoff in ms between retries; doubles each attempt. Defaults to 400. */
  backoffMs?: number;
}

const DEFAULT_RETRIES = 1;
const DEFAULT_BACKOFF_MS = 400;
const RETRYABLE_STATUSES = new Set<number>([408, 425, 429, 500, 502, 503, 504]);

/**
 * Fetch with timeout + single retry + structured errors.
 *
 * Returns an OK Response. Throws `NourishHttpError` on:
 *   - timeout (kind: "timeout", transient)
 *   - network failure (kind: "network", transient)
 *   - rate limit after retries exhausted (kind: "rate_limit", transient)
 *   - 5xx after retries exhausted (kind: "server_error", transient)
 *   - other non-OK HTTP status (kind: "http", NOT transient)
 */
export async function fetchWithTimeout(
  input: URL | string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs, retries, backoffMs, ...init } = options;
  const url = typeof input === "string" ? input : input.toString();
  const config = getConfig();
  const effectiveTimeout = timeoutMs ?? config.provider_timeout_ms;
  const maxAttempts = (retries ?? DEFAULT_RETRIES) + 1;
  const baseBackoff = backoffMs ?? DEFAULT_BACKOFF_MS;

  let lastError: NourishHttpError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    let response: Response;
    try {
      response = await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || err.name === "TimeoutError" || /aborted/i.test(err.message));
      lastError = new NourishHttpError({
        kind: isAbort ? "timeout" : "network",
        message: isAbort
          ? `Request timed out after ${effectiveTimeout}ms (attempt ${attempt}/${maxAttempts}): ${url}`
          : `Network error after ${attempt} attempt(s) for ${url}: ${(err as Error).message}`,
        url,
        attempts: attempt,
      });

      if (attempt < maxAttempts) {
        await sleep(baseBackoff * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    }
    clearTimeout(timer);

    if (response.ok) {
      return response;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
      lastError = new NourishHttpError({
        kind: response.status === 429 ? "rate_limit" : "server_error",
        message: `${response.status} ${response.statusText} (attempt ${attempt}/${maxAttempts}): ${url}`,
        url,
        status: response.status,
        attempts: attempt,
      });
      await sleep(baseBackoff * 2 ** (attempt - 1));
      continue;
    }

    // Final non-OK response: classify and throw.
    const kind: NourishHttpErrorKind =
      response.status === 429
        ? "rate_limit"
        : response.status >= 500
          ? "server_error"
          : "http";
    throw new NourishHttpError({
      kind,
      message: `${response.status} ${response.statusText}: ${url}`,
      url,
      status: response.status,
      attempts: attempt,
    });
  }

  // Unreachable — the loop either returns or throws — but TS needs it.
  throw lastError ?? new NourishHttpError({
    kind: "network",
    message: `Failed after ${maxAttempts} attempts: ${url}`,
    url,
    attempts: maxAttempts,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientHttpError(error: unknown): error is NourishHttpError {
  return error instanceof NourishHttpError && error.transient;
}
