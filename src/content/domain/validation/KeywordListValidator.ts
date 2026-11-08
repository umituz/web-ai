
import { ValidationLimits } from '../limits/ValidationLimits';
import { ValidationError } from '../errors/AIErrors';

export function validateKeywordList(keywords: unknown): string[] {
  if (!Array.isArray(keywords)) {
    throw new ValidationError('Keywords must be an array');
  }
  if (keywords.length > ValidationLimits.KEYWORD.MAX_COUNT) {
    throw new ValidationError(`Cannot process more than ${ValidationLimits.KEYWORD.MAX_COUNT} keywords`);
  }
  return keywords
    .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    .map((keyword) => {
      const trimmed = keyword.trim();
      if (trimmed.length > ValidationLimits.KEYWORD.MAX_LENGTH) {
        const preview = trimmed.substring(0, 20);
        throw new ValidationError(
          `Keyword "${preview}..." exceeds maximum length of ${ValidationLimits.KEYWORD.MAX_LENGTH} characters`,
        );
      }
      return trimmed;
    });
}
