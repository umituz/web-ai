
export interface ExponentialBackoffParams {
  readonly attempt: number;
  readonly initialDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
  readonly jitterFactor: number;
  readonly random?: () => number;
}

export function calculateExponentialBackoff(params: ExponentialBackoffParams): number {
  const {
    attempt,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    jitterFactor,
    random = Math.random,
  } = params;

  const base = initialDelay * Math.pow(backoffMultiplier, Math.max(0, attempt - 1));
  const capped = Math.min(base, maxDelay);
  const jitterMultiplier = random() * 2 - 1;
  const jitter = capped * jitterFactor * jitterMultiplier;

  return Math.max(0, capped + jitter);
}
