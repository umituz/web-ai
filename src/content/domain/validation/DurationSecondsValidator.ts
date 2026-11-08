
import { ValidationLimits } from '../limits/ValidationLimits';
import { ValidationError } from '../errors/AIErrors';

export function validateDurationSeconds(duration: number): number {
  if (!Number.isFinite(duration)) {
    throw new ValidationError(
      `Duration must be between ${ValidationLimits.DURATION_SECONDS.MIN} and ${ValidationLimits.DURATION_SECONDS.MAX} seconds`,
    );
  }
  if (duration < ValidationLimits.DURATION_SECONDS.MIN || duration > ValidationLimits.DURATION_SECONDS.MAX) {
    throw new ValidationError(
      `Duration must be between ${ValidationLimits.DURATION_SECONDS.MIN} and ${ValidationLimits.DURATION_SECONDS.MAX} seconds`,
    );
  }
  return duration;
}
