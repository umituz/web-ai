
export interface ApiKeyValidationRule {
  readonly minLength: number;
}

export const DEFAULT_API_KEY_RULE: ApiKeyValidationRule = {
  minLength: 10,
};

export function isValidApiKey(
  apiKey: string | undefined | null,
  rule: ApiKeyValidationRule = DEFAULT_API_KEY_RULE,
): apiKey is string {
  if (!apiKey) return false;
  return apiKey.trim().length >= rule.minLength;
}

export function validateApiKey(
  apiKey: string | undefined | null,
  rule: ApiKeyValidationRule = DEFAULT_API_KEY_RULE,
): { valid: boolean; reason?: string } {
  if (!apiKey) {
    return { valid: false, reason: "API key is required" };
  }
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: "API key cannot be empty" };
  }
  if (trimmed.length < rule.minLength) {
    return {
      valid: false,
      reason: `API key must be at least ${rule.minLength} characters`,
    };
  }
  return { valid: true };
}
