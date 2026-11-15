
import {
  FalQueueError,
  type FalQueueEnv,
  type FalStatusResponse,
  type FalStatusSnapshot,
  type FalSubmitResponse,
  type FalSubmittedJob,
} from './fal-queue.entities';

/**
 * fal.ai queue client — thin fetch wrapper, no SDK dependency: configured
 * guard, FalQueueError with status + body slice, AbortSignal timeout, one
 * 5xx retry.
 *
 * Two hard rules from the production ports (vivoim_api, storyora):
 *   1. statusUrl/responseUrl are stored ABSOLUTE at submit time and GET'd
 *      verbatim — never rebuild model paths from URL segments.
 *   2. auth is fal's `Key <token>` scheme, not Bearer.
 */

const FAL_QUEUE_BASE = 'https://queue.fal.run';
const FAL_SUBMIT_TIMEOUT_MS = 15_000;
const FAL_POLL_TIMEOUT_MS = 10_000;

/** The fal lane is live only when the FAL_KEY secret exists. */
export function falQueueConfigured(env: FalQueueEnv): boolean {
  return Boolean(env.FAL_KEY);
}

/** Key-authenticated fal call with a timeout and a single 5xx retry. */
async function falFetch<T>(
  env: FalQueueEnv,
  url: string,
  timeoutMs: number,
  body?: unknown,
): Promise<T> {
  if (!falQueueConfigured(env)) throw new FalQueueError('fal.ai is not configured');
  const request = async (): Promise<Response> =>
    fetch(url, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: {
        Authorization: `Key ${env.FAL_KEY}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  let res: Response;
  try {
    res = await request();
    if (res.status >= 500) res = await request(); // one retry on server errors
  } catch (err) {
    throw new FalQueueError(err instanceof Error ? err.message : 'fal.ai request failed');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new FalQueueError(`fal ${res.status}: ${text.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}

/** The queue surface one env yields. Stateless by design — one object per
 *  request handler is fine, and so is a module-level singleton. */
export interface FalQueueClient {
  /** POST /{model} — returns the absolute URLs persisted on the job row. */
  submit(model: string, input: Record<string, unknown>): Promise<FalSubmittedJob>;
  /** GET the STORED status URL — never reconstructed from model paths. */
  checkStatus(statusUrl: string): Promise<FalStatusSnapshot>;
  /** GET the STORED response URL — only called after COMPLETED. */
  fetchResult(responseUrl: string): Promise<unknown>;
}

/** Build the queue client for an env (`createFalQueue(c.env)` in a route). */
export function createFalQueue(env: FalQueueEnv): FalQueueClient {
  return {
    async submit(model: string, input: Record<string, unknown>): Promise<FalSubmittedJob> {
      const res = await falFetch<FalSubmitResponse>(env, `${FAL_QUEUE_BASE}/${model}`, FAL_SUBMIT_TIMEOUT_MS, input);
      return { requestId: res.request_id, statusUrl: res.status_url, responseUrl: res.response_url };
    },
    async checkStatus(statusUrl: string): Promise<FalStatusSnapshot> {
      const res = await falFetch<FalStatusResponse>(env, statusUrl, FAL_POLL_TIMEOUT_MS);
      return {
        status: res.status,
        queuePosition: res.queue_position,
        logs: res.logs?.map((l) => l.message ?? '').filter(Boolean),
      };
    },
    fetchResult(responseUrl: string): Promise<unknown> {
      return falFetch<unknown>(env, responseUrl, FAL_POLL_TIMEOUT_MS);
    },
  };
}
