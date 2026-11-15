import { describe, expect, it } from 'vitest';
import { createAllowanceWindow, DEFAULT_ALLOWANCE_WINDOW_MS } from '../../src/core/utils/allowance-window';

describe('createAllowanceWindow', () => {
  it('allows requests up to the limit within one window', () => {
    const window = createAllowanceWindow({ limit: 3 });
    expect(window.allow('u1', 1000)).toBe(true);
    expect(window.allow('u1', 2000)).toBe(true);
    expect(window.allow('u1', 3000)).toBe(true);
    expect(window.allow('u1', 4000)).toBe(false);
  });

  it('opens a fresh window after windowMs elapses', () => {
    const window = createAllowanceWindow({ limit: 2, windowMs: 3_600_000 });
    expect(window.allow('u1', 0)).toBe(true);
    expect(window.allow('u1', 1_000)).toBe(true);
    expect(window.allow('u1', 2_000)).toBe(false);
    expect(window.allow('u1', 3_600_001)).toBe(true);
  });

  it('tracks keys independently', () => {
    const window = createAllowanceWindow({ limit: 1 });
    expect(window.allow('a', 0)).toBe(true);
    expect(window.allow('a', 1)).toBe(false);
    expect(window.allow('b', 1)).toBe(true);
  });

  it('defaults to a one hour window', () => {
    expect(DEFAULT_ALLOWANCE_WINDOW_MS).toBe(3_600_000);
    const window = createAllowanceWindow({ limit: 1 });
    expect(window.allow('u', 0)).toBe(true);
    expect(window.allow('u', 3_600_000)).toBe(true);
  });
});
