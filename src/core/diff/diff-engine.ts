export interface DiffLine {
  readonly type: 'same' | 'add' | 'remove';
  readonly text: string;
}

export interface DiffChangeCount {
  readonly added: number;
  readonly removed: number;
}

const DIFF_MAX_CELLS = 4_000_000;

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');

  if (a.length * b.length > DIFF_MAX_CELLS) {
    return [
      ...a.map((text) => ({ type: 'remove' as const, text })),
      ...b.map((text) => ({ type: 'add' as const, text })),
    ];
  }

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      const row = dp[i];
      if (row) {
        row[j] = a[i] === b[j] ? (dp[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(dp[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
      }
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] ?? '' });
      i += 1;
      j += 1;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      out.push({ type: 'remove', text: a[i] ?? '' });
      i += 1;
    } else {
      out.push({ type: 'add', text: b[j] ?? '' });
      j += 1;
    }
  }
  while (i < m) {
    out.push({ type: 'remove', text: a[i] ?? '' });
    i += 1;
  }
  while (j < n) {
    out.push({ type: 'add', text: b[j] ?? '' });
    j += 1;
  }
  return out;
}

export function countChanges(lines: readonly DiffLine[]): DiffChangeCount {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === 'add') added += 1;
    else if (line.type === 'remove') removed += 1;
  }
  return { added, removed };
}
