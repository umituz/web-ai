
export interface MessageContentValidationRule {
  readonly minLength: number;
}

export const DEFAULT_MESSAGE_CONTENT_RULE: MessageContentValidationRule = {
  minLength: 1,
};

export function isMeaningfulMessageContent(
  text: string | undefined | null,
  rule: MessageContentValidationRule = DEFAULT_MESSAGE_CONTENT_RULE,
): boolean {
  if (!text) return false;
  return text.trim().length >= rule.minLength;
}

export function trimMessageContent(text: string): string {
  return text.trim();
}
