
import { POLL_DEFAULTS } from '../constants/limits';

export interface BackoffInputs {
  attempt: number;
  baseIntervalMs: number;
  maxIntervalMs?: number;
  jitterPercent?: number;
  growthBase?: number;
}

export function calculateExponentialBackoff(inputs: BackoffInputs): number {
  const {
    attempt,
    baseIntervalMs,
    maxIntervalMs = POLL_DEFAULTS.maxIntervalMs,
    jitterPercent = POLL_DEFAULTS.jitterPercent,
    growthBase = POLL_DEFAULTS.backoffBase,
  } = inputs;

  const safeAttempt = Math.max(0, attempt);
  const safeBase = Math.max(0, baseIntervalMs);
  const exponentialDelay = Math.min(safeBase * Math.pow(growthBase, safeAttempt), maxIntervalMs);
  const jitter = exponentialDelay * jitterPercent * Math.random();
  return exponentialDelay + jitter;
}
