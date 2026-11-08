
import { ProviderTimingConfig } from '../limits/ProviderTimingConfig';

export function calculateRetryBackoffDelayMs(attemptIndex: number): number {
  return ProviderTimingConfig.RETRY_BACKOFF_BASE_MS * Math.pow(2, attemptIndex);
}
