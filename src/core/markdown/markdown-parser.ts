export interface MarkdownSegment {
  readonly kind: 'text' | 'code';
  readonly text: string;
  readonly language?: string;
}

const FENCE_PATTERN = /```([\w+-]*)\n?([\s\S]*?)(?:```|$)/g;
const TITLE_COMMENT_PREFIX = /^(?:\/\/|#|--|\/\*|<!--|\*)\s*/;
const TITLE_MAX_CHARS = 60;

export function splitMarkdown(source: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  FENCE_PATTERN.lastIndex = 0;

  while ((match = FENCE_PATTERN.exec(source)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: 'text', text: source.slice(cursor, match.index) });
    }
    segments.push({ kind: 'code', text: match[2] ?? '', language: match[1] || undefined });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) {
    segments.push({ kind: 'text', text: source.slice(cursor) });
  }
  return segments;
}

export function deriveSnippetTitle(code: string): string {
  const firstLine = code
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return 'Snippet';
  const stripped = firstLine.replace(TITLE_COMMENT_PREFIX, '').replace(/\*\/$/, '').trim();
  const cleaned = stripped.length > 0 ? stripped : firstLine;
  return cleaned.length > TITLE_MAX_CHARS ? `${cleaned.slice(0, TITLE_MAX_CHARS)}…` : cleaned;
}
