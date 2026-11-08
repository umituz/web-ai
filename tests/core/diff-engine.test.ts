import { describe, expect, it } from 'vitest';
import {
  diffLines,
  countChanges,
} from '../../src/core/diff/diff-engine';

describe('diffLines', () => {
  it('returns same lines when strings are identical', () => {
    const text = 'line 1\nline 2';
    const lines = diffLines(text, text);
    expect(lines).toEqual([
      { type: 'same', text: 'line 1' },
      { type: 'same', text: 'line 2' },
    ]);
  });

  it('detects added and removed lines', () => {
    const before = 'alpha\nbeta\ngamma';
    const after = 'alpha\nbeta-modified\ngamma\ndelta';
    const lines = diffLines(before, after);

    expect(lines).toEqual([
      { type: 'same', text: 'alpha' },
      { type: 'remove', text: 'beta' },
      { type: 'add', text: 'beta-modified' },
      { type: 'same', text: 'gamma' },
      { type: 'add', text: 'delta' },
    ]);
  });

  it('countChanges correctly sums additions and removals', () => {
    const before = 'a\nb\nc';
    const after = 'a\nx\nc\ny';
    const diff = diffLines(before, after);
    const counts = countChanges(diff);
    expect(counts.removed).toBe(1);
    expect(counts.added).toBe(2);
  });
});
