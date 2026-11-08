
import { ValidationLimits } from '../limits/ValidationLimits';
import { ValidationError } from '../errors/AIErrors';

export function validateTopicText(topic: string): string {
  if (typeof topic !== 'string' || topic.trim().length < ValidationLimits.TOPIC.MIN) {
    throw new ValidationError('Topic cannot be empty');
  }
  const trimmed = topic.trim();
  if (trimmed.length > ValidationLimits.TOPIC.MAX) {
    throw new ValidationError(`Topic exceeds maximum length of ${ValidationLimits.TOPIC.MAX} characters`);
  }
  return trimmed;
}
