import { describe, expect, it } from 'vitest';
import { AIErrorType } from '../../src/core/errors/ai-error-types';
import { GroqError } from '../../src/core/errors/groq-error';
import { AiError } from '../../src/core/errors/unified-ai-error';
import { aiFailureOf } from '../../src/core/errors/ai-failure';

describe('aiFailureOf', () => {
  it('passes AiError through with its status and message', () => {
    const failure = aiFailureOf(new AiError('rate_limited'));
    expect(failure).toEqual({
      code: 'rate_limited',
      status: 429,
      message: 'The provider rate limit was reached. Try again shortly.',
    });
  });

  it('maps GroqError rate limiting to 429', () => {
    const failure = aiFailureOf(new GroqError(AIErrorType.RATE_LIMIT_ERROR, 'rate limited'));
    expect(failure.code).toBe('rate_limited');
    expect(failure.status).toBe(429);
  });

  it('maps GroqError abort to timeout 504', () => {
    const failure = aiFailureOf(new GroqError(AIErrorType.ABORT_ERROR, 'aborted'));
    expect(failure.code).toBe('timeout');
    expect(failure.status).toBe(504);
  });

  it('maps GroqError invalid key to invalid_key', () => {
    const failure = aiFailureOf(new GroqError(AIErrorType.INVALID_API_KEY, 'bad key'));
    expect(failure.code).toBe('invalid_key');
    expect(failure.status).toBe(502);
  });

  it('maps native AbortError to timeout', () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    const failure = aiFailureOf(error);
    expect(failure.code).toBe('timeout');
    expect(failure.status).toBe(504);
  });

  it('maps unknown errors to upstream_error 502', () => {
    expect(aiFailureOf(new Error('boom')).code).toBe('upstream_error');
    expect(aiFailureOf('nope').code).toBe('upstream_error');
    expect(aiFailureOf(undefined).status).toBe(502);
  });

  it('always carries a user-facing message', () => {
    expect(aiFailureOf(new GroqError(AIErrorType.SERVER_ERROR, 'x')).message.length).toBeGreaterThan(0);
  });
});
