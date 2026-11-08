import { capText } from '../parsers/text-extract';

export const MEMORY_MAX_ITEMS = 20;
export const MEMORY_TOTAL_LIMIT = 4_000;

export interface MemoryLike {
  readonly content: string;
  readonly pinned: boolean;
  readonly updatedAt: Date | string | number;
}

function resolveTimestamp(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function selectMemories(
  rows: readonly MemoryLike[],
  maxItems: number = MEMORY_MAX_ITEMS,
  totalLimit: number = MEMORY_TOTAL_LIMIT,
  capper: (text: string, limit: number) => string = capText,
): string[] {
  const ordered = [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return resolveTimestamp(b.updatedAt) - resolveTimestamp(a.updatedAt);
  });

  const out: string[] = [];
  let used = 0;
  for (const row of ordered) {
    if (out.length >= maxItems || used >= totalLimit) break;
    const content = row.content.trim();
    if (content.length === 0) continue;
    const capped = capper(content, totalLimit - used);
    out.push(capped);
    used += capped.length;
  }
  return out;
}
