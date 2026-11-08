
import { ValidationLimits } from '../limits/ValidationLimits';
import { ValidationError } from '../errors/AIErrors';

export function validateContentBody(content: string): string {
  if (typeof content !== 'string' || content.trim().length < ValidationLimits.CONTENT.MIN) {
    throw new ValidationError('Content cannot be empty');
  }
  const trimmed = content.trim();
  if (trimmed.length > ValidationLimits.CONTENT.MAX) {
    throw new ValidationError(`Content exceeds maximum length of ${ValidationLimits.CONTENT.MAX} characters`);
  }
  return trimmed;
}

export function truncateForSeoPreview(content: string): string {
  return content.substring(0, ValidationLimits.SEO_CONTENT_PREVIEW);
}

export function truncateForBlogPromptPreview(content: string): string {
  return content.substring(0, ValidationLimits.BLOG_PROMPT_PREVIEW);
}

export function truncateForAbVariantPreview(content: string): string {
  return content.substring(0, ValidationLimits.AB_VARIANT_CONTENT_PREVIEW);
}
