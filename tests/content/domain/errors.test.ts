import { describe, expect, it } from 'vitest';
import {
  AIError,
  ProviderQuotaExhaustedError,
  ProviderUnavailableError,
  ValidationError,
} from '../../../src/content/domain/errors/AIErrors';
import { ProviderError } from '../../../src/providers/base/base.provider';

describe('AIError', () => {
  it('carries a stable code and cause', () => {
    const cause = new Error('boom');
    const err = new AIError('something failed', 'NETWORK_ERROR', cause);
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('AIError');
    expect(err).toBeInstanceOf(Error);
  });

  it('from() passes through AIError instances unchanged', () => {
    const original = new AIError('original', 'TIMEOUT');
    expect(AIError.from(original)).toBe(original);
  });

  it('from() maps plain errors to coded AIErrors', () => {
    expect(AIError.from(new Error('Request quota exceeded')).code).toBe('PROVIDER_QUOTA_EXHAUSTED');
    expect(AIError.from(new Error('operation aborted')).code).toBe('ABORTED');
    expect(AIError.from(new Error('request timeout')).code).toBe('TIMEOUT');
    expect(AIError.from('weird string value').code).toBe('UNKNOWN');
    expect(AIError.from(null, 'PARSE_ERROR').code).toBe('PARSE_ERROR');
  });

  it('subclasses expose their category codes', () => {
    expect(new ValidationError('bad input').code).toBe('VALIDATION_ERROR');
    expect(new ProviderUnavailableError('groq').code).toBe('PROVIDER_UNAVAILABLE');
    expect(new ProviderQuotaExhaustedError('fal').code).toBe('PROVIDER_QUOTA_EXHAUSTED');
  });
});

describe('ProviderError (infrastructure)', () => {
  it('participates in the AIError taxonomy while keeping its identity', () => {
    const original = new Error('upstream 503');
    const err = new ProviderError('fal failed', 'fal', original);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AIError);
    expect(err.name).toBe('ProviderError');
    expect(err.providerId).toBe('fal');
    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err.cause).toBe(original);
  });

  it('is classified by AIError.from without losing its message', () => {
    const err = new ProviderError('quota hit', 'groq');
    const mapped = AIError.from(err);
    expect(mapped).toBe(err);
    expect(mapped.message).toBe('quota hit');
  });
});
