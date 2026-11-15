export interface DeriveTitleOptions {
  /** Returned when the content yields no usable text. Defaults to "". */
  readonly fallback?: string;
  /** Maximum title length before truncation. Defaults to 60. */
  readonly maxChars?: number;
}

/**
 * Derive a human conversation title from the first user message: takes the
 * first non-empty line, strips Markdown list/heading prefixes, collapses
 * whitespace and truncates with an ellipsis.
 */
export function deriveConversationTitle(
  content: string,
  options: DeriveTitleOptions = {},
): string {
  const fallback = options.fallback ?? "";
  const maxChars = options.maxChars ?? 60;
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const cleaned = (firstLine ?? fallback)
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[>*-]\s+/, "")
    .replace(/\s+/g, " ");
  if (cleaned.length === 0) return fallback;
  return cleaned.length > maxChars
    ? `${cleaned.slice(0, maxChars).trimEnd()}…`
    : cleaned;
}
