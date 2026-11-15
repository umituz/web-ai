import type { AiErrorCode } from "./unified-ai-error";

/**
 * HTTP status each AiErrorCode maps to when an AI failure is surfaced
 * through a server route (hono/express-style `c.json(body, status)`).
 *
 * The map is intentionally `as const` so indexed access keeps the literal
 * types — frameworks like hono type their status argument as a union of
 * known literals, and a plain `Record<AiErrorCode, number>` would widen
 * past it.
 */
export const AI_ERROR_STATUS = {
  invalid_key: 502,
  missing_key: 503,
  rate_limited: 429,
  capacity: 503,
  timeout: 504,
  invalid_request: 400,
  model_unavailable: 503,
  upstream_error: 502,
  network: 502,
  cancelled: 400,
} as const satisfies Readonly<Record<AiErrorCode, number>>;

/** Status for a single code; kept as a function for call sites that only
 *  have the code, not an AiError instance. */
export function aiErrorStatus(code: AiErrorCode): number {
  return AI_ERROR_STATUS[code];
}
