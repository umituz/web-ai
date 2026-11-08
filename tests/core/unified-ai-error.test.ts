import { describe, expect, it } from 'vitest';
import {
  AiError,
  aiErrorMessage,
  errorFromStatus,
  errorFromUnknown,
} from '../../src/core/errors/unified-ai-error';

describe('unified-ai-error', () => {
  it('instantiates with default message matching code', () => {
    const err = new AiError('rate_limited');
    expect(err.code).toBe('rate_limited');
    expect(err.message).toContain('rate limit');
    expect(err.userMessage).toBe(err.message);
    expect(err.name).toBe('AiError');
  });

  it('preserves custom message when provided', () => {
    const err = new AiError('capacity', 'Custom capacity warning');
    expect(err.code).toBe('capacity');
    expect(err.message).toBe('Custom capacity warning');
  });

  it('aiErrorMessage returns default explanation', () => {
    expect(aiErrorMessage('missing_key')).toContain('API key');
    expect(aiErrorMessage('timeout')).toContain('too long');
  });

  it('maps standard HTTP statuses to codes', () => {
    expect(errorFromStatus(400).code).toBe('invalid_request');
    expect(errorFromStatus(401).code).toBe('invalid_key');
    expect(errorFromStatus(429).code).toBe('rate_limited');
    expect(errorFromStatus(503).code).toBe('capacity');
    expect(errorFromStatus(504).code).toBe('timeout');
    expect(errorFromStatus(500).code).toBe('upstream_error');
  });

  it('maps 403 to model_unavailable when provider specifies it is not an api key rejection', () => {
    const err = errorFromStatus(403, undefined, { code: 'model_not_found', type: 'invalid_model' });
    expect(err.code).toBe('model_unavailable');
  });

  it('attaches detail to message when provided', () => {
    const err = errorFromStatus(429, 'limit: 100/min');
    expect(err.message).toContain('limit: 100/min');
  });

  it('errorFromUnknown handles AiError, Error names, and fallbacks', () => {
    const existing = new AiError('network');
    expect(errorFromUnknown(existing)).toBe(existing);

    const abort = new Error('abort');
    abort.name = 'AbortError';
    expect(errorFromUnknown(abort).code).toBe('timeout');

    const net = new TypeError('fetch failed');
    expect(errorFromUnknown(net).code).toBe('network');

    const plain = new Error('custom message');
    const out = errorFromUnknown(plain);
    expect(out.code).toBe('upstream_error');
    expect(out.message).toBe('custom message');

    expect(errorFromUnknown('string error').code).toBe('upstream_error');
  });
});
