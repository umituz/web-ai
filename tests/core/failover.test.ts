import { describe, expect, it } from 'vitest';
import {
  canFailover,
  failoverCandidate,
  isTransientError,
} from '../../src/core/utils/failover';

function mockModel(providerId: string, streaming = true) {
  return {
    model: {
      id: `model_${providerId}`,
      capabilities: { streaming },
    },
    provider: { id: providerId },
  };
}

describe('canFailover', () => {
  it('allows failover for transient errors before any output streamed', () => {
    expect(canFailover({ code: 'capacity' }, 0)).toBe(true);
    expect(canFailover({ code: 'rate_limited' }, 0)).toBe(true);
    expect(canFailover({ code: 'timeout' }, 0)).toBe(true);
    expect(canFailover({ code: 'network' }, 0)).toBe(true);
    expect(canFailover({ status: 429 }, 0)).toBe(true);
    expect(canFailover({ status: 503 }, 0)).toBe(true);
  });

  it('blocks failover after partial output streamed', () => {
    expect(canFailover({ code: 'capacity' }, 12)).toBe(false);
  });

  it('blocks failover for deterministic errors and unknown throws', () => {
    expect(canFailover({ code: 'invalid_key' }, 0)).toBe(false);
    expect(canFailover({ code: 'invalid_request' }, 0)).toBe(false);
    expect(canFailover(new Error('boom'), 0)).toBe(false);
  });

  it('detects transient errors reliably', () => {
    expect(isTransientError({ type: 'rate_limited' })).toBe(true);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError('random string')).toBe(false);
  });
});

describe('failoverCandidate', () => {
  it('returns the fallback when it lives on another provider', () => {
    const primary = mockModel('provider_a');
    const fallback = mockModel('provider_b');
    expect(failoverCandidate(primary, fallback)).toBe(fallback);
  });

  it('rejects same-provider, missing, and non-streaming fallbacks', () => {
    const primary = mockModel('provider_a');
    expect(failoverCandidate(primary, primary)).toBeNull();
    expect(failoverCandidate(primary, null)).toBeNull();
    expect(failoverCandidate(primary, mockModel('provider_b', false))).toBeNull();
  });
});
