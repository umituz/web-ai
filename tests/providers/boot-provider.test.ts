import { afterEach, describe, expect, it } from 'vitest';
import { bootProvider, getProvider, resetProvider } from '../../src/providers/groq/groq-container';

describe('bootProvider', () => {
  afterEach(() => {
    resetProvider();
  });

  it('returns null for a missing or too short key', () => {
    expect(bootProvider(undefined)).toBeNull();
    expect(bootProvider('short')).toBeNull();
    expect(bootProvider('   ')).toBeNull();
  });

  it('configures the singleton container for a valid key', () => {
    const container = bootProvider('gsk_valid_key_0123456789');
    expect(container).not.toBeNull();
    expect(getProvider()).toBe(container);
  });

  it('memoizes the container across calls', () => {
    const first = bootProvider('gsk_valid_key_0123456789');
    const second = bootProvider('gsk_other_key_0123456789');
    expect(second).toBe(first);
  });

  it('rebuilds after resetProvider', () => {
    const first = bootProvider('gsk_valid_key_0123456789');
    resetProvider();
    const second = bootProvider('gsk_valid_key_0123456789');
    expect(second).not.toBe(first);
  });

  it('returns null again after reset with an invalid key', () => {
    bootProvider('gsk_valid_key_0123456789');
    resetProvider();
    expect(bootProvider('nope')).toBeNull();
  });
});
