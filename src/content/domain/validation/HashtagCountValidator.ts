
import { ValidationLimits } from '../limits/ValidationLimits';
import { ValidationError } from '../errors/AIErrors';

export function validateHashtagCount(count: number): number {
  if (!Number.isFinite(count)) {
    throw new ValidationError(
      `Hashtag count must be between ${ValidationLimits.HASHTAG_COUNT.MIN} and ${ValidationLimits.HASHTAG_COUNT.MAX}`,
    );
  }
  if (count < ValidationLimits.HASHTAG_COUNT.MIN || count > ValidationLimits.HASHTAG_COUNT.MAX) {
    throw new ValidationError(
      `Hashtag count must be between ${ValidationLimits.HASHTAG_COUNT.MIN} and ${ValidationLimits.HASHTAG_COUNT.MAX}`,
    );
  }
  return Math.floor(count);
}
