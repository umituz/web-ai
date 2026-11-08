export const CHUNK_MAX_CHARS = 1200;
export const CHUNK_OVERLAP_CHARS = 160;
export const CHUNK_TEXT_LIMIT = 200_000;

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

function boundaryOf(slice: string): number {
  const sentence = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('.\n'),
    slice.lastIndexOf('.'),
  );
  if (sentence >= 0) return sentence + 1;
  const newline = slice.lastIndexOf('\n');
  if (newline >= 0) return newline + 1;
  return slice.lastIndexOf(' ') + 1;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = Math.max(options.maxChars ?? CHUNK_MAX_CHARS, 64);
  const overlapChars = Math.min(
    Math.max(options.overlapChars ?? CHUNK_OVERLAP_CHARS, 0),
    Math.floor(maxChars / 2),
  );

  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (normalized.length === 0) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    let carry = '';
    if (current.length > 0) {
      chunks.push(current);
      carry = current.slice(-overlapChars).trim();
    }

    let remaining = paragraph;
    while (remaining.length + carry.length + 1 > maxChars) {
      const budget = maxChars - (carry.length > 0 ? carry.length + 1 : 0);
      const boundary = boundaryOf(remaining.slice(0, budget));
      const consumed = boundary > Math.floor(budget / 2) ? boundary : budget;
      const piece = (carry.length > 0 ? `${carry} ` : '') + remaining.slice(0, consumed);
      chunks.push(piece.trim());
      remaining = remaining.slice(consumed).trim();
      carry = piece.slice(-overlapChars).trim();
    }

    current = carry.length > 0 && remaining.length > 0 ? `${carry} ${remaining}` : remaining;
  }

  if (current.trim().length > 0) chunks.push(current.trim());

  return chunks
    .map((chunk) => (chunk.length > maxChars ? chunk.slice(0, maxChars) : chunk))
    .filter((chunk) => chunk.length > 0);
}
