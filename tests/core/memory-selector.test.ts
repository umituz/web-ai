import { describe, expect, it } from 'vitest';
import {
  selectMemories,
  type MemoryLike,
} from '../../src/core/memory/memory-selector';

describe('selectMemories', () => {
  const baseDate = new Date('2026-11-08T12:00:00Z');

  it('orders pinned memories before unpinned memories', () => {
    const rows: MemoryLike[] = [
      { content: 'unpinned fresh', pinned: false, updatedAt: new Date('2026-11-08T13:00:00Z') },
      { content: 'pinned older', pinned: true, updatedAt: new Date('2026-11-08T10:00:00Z') },
    ];
    const out = selectMemories(rows);
    expect(out).toEqual(['pinned older', 'unpinned fresh']);
  });

  it('orders by recency among items with same pinned status', () => {
    const rows: MemoryLike[] = [
      { content: 'older', pinned: false, updatedAt: new Date('2026-11-08T10:00:00Z') },
      { content: 'newer', pinned: false, updatedAt: new Date('2026-11-08T11:00:00Z') },
    ];
    const out = selectMemories(rows);
    expect(out).toEqual(['newer', 'older']);
  });

  it('respects maxItems limit', () => {
    const rows: MemoryLike[] = Array.from({ length: 10 }, (_, i) => ({
      content: `Memory ${i}`,
      pinned: false,
      updatedAt: baseDate,
    }));
    const out = selectMemories(rows, 3);
    expect(out).toHaveLength(3);
  });

  it('respects totalLimit character ceiling and marks truncated tail', () => {
    const rows: MemoryLike[] = [
      { content: 'a'.repeat(30), pinned: true, updatedAt: baseDate },
      { content: 'b'.repeat(30), pinned: false, updatedAt: baseDate },
    ];
    const out = selectMemories(rows, 10, 45);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe('a'.repeat(30));
    expect(out[1].startsWith('b'.repeat(15))).toBe(true);
    expect(out[1].endsWith('[truncated]')).toBe(true);
  });

  it('ignores blank memories', () => {
    const rows: MemoryLike[] = [
      { content: '   \n  ', pinned: true, updatedAt: baseDate },
      { content: 'valid', pinned: false, updatedAt: baseDate },
    ];
    const out = selectMemories(rows);
    expect(out).toEqual(['valid']);
  });
});
