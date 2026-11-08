import { describe, expect, it, vi } from 'vitest';
import {
  extractJSON,
  isValidJSON,
  parseAIResponse,
  safeJSONParse,
} from '../../../src/content/infrastructure/utils/jsonParser';

describe('extractJSON', () => {
  it('extracts a fenced JSON block even when surrounding prose contains braces', () => {
    const noisy = 'Sure! Here { is some "json" }\n```json\n{"a":1}\n```\nEnjoy!';
    expect(extractJSON(noisy)).toBe('{"a":1}');
  });

  it('extracts a fenced array', () => {
    expect(extractJSON('```\n[1,2,3]\n```')).toBe('[1,2,3]');
  });

  it('extracts a bare object embedded in prose', () => {
    expect(extractJSON('The answer is {"a":1} as requested')).toBe('{"a":1}');
  });

  it('extracts a bare array', () => {
    expect(extractJSON('result: [1,2,3] done')).toBe('[1,2,3]');
  });

  it('returns null when no JSON is present', () => {
    expect(extractJSON('no json here')).toBeNull();
    expect(extractJSON('')).toBeNull();
  });

  it('ignores fences whose content is not JSON-shaped', () => {
    expect(extractJSON('```plain\ntext only\n``` followed by {"a":1}')).toBe('{"a":1}');
  });
});

describe('safeJSONParse', () => {
  it('parses valid JSON', () => {
    expect(safeJSONParse('{"a":1}', null)).toEqual({ a: 1 });
  });

  it('returns the fallback on malformed JSON', () => {
    expect(safeJSONParse('{broken', 'fallback')).toBe('fallback');
  });

  it('reports parse context through onError', () => {
    const onError = vi.fn();
    safeJSONParse('{broken', 'fallback', onError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toContain('JSON parse error');
  });
});

describe('parseAIResponse', () => {
  it('parses JSON wrapped in prose and fences', () => {
    expect(parseAIResponse('```json\n{"score": 42}\n```', { score: 0 })).toEqual({ score: 42 });
  });

  it('returns the fallback when nothing parseable exists', () => {
    expect(parseAIResponse('totally not json', { safe: true })).toEqual({ safe: true });
  });

  it('surfaces parse failures through onError while keeping the fallback', () => {
    const onError = vi.fn();
    const result = parseAIResponse('{"unterminated', 0, onError);
    expect(result).toBe(0);
    expect(onError).toHaveBeenCalled();
  });
});

describe('isValidJSON', () => {
  it('accepts valid objects and arrays', () => {
    expect(isValidJSON('{"a":1}')).toBe(true);
    expect(isValidJSON(' [1,2] ')).toBe(true);
  });

  it('rejects malformed and non-JSON input', () => {
    expect(isValidJSON('{"a":')).toBe(false);
    expect(isValidJSON('plain text')).toBe(false);
    expect(isValidJSON('')).toBe(false);
  });
});

describe('safeJSONParse repair pass', () => {
  it('repairs a stray quote after a numeric value (gpt-oss calendar defect)', () => {
    const payload = '[\n  {\n    "day": 7",\n    "topic": "Recovery run"\n  }\n]';
    expect(safeJSONParse(payload, [])).toEqual([{ day: 7, topic: 'Recovery run' }]);
  });

  it('repairs a duplicated closing quote on string values', () => {
    const payload = '{"title": "Winter trail", "note": "tag the brand""}';
    expect(safeJSONParse(payload, {})).toEqual({ title: 'Winter trail', note: 'tag the brand' });
  });

  it('keeps the fallback when the payload is beyond repair', () => {
    expect(safeJSONParse('{"unterminated', { safe: true })).toEqual({ safe: true });
  });

  it('does not touch valid JSON that merely contains quotes in strings', () => {
    expect(safeJSONParse('{"quote": "he said \\"hi\\"", "n": 5}', {})).toEqual({
      quote: 'he said "hi"',
      n: 5,
    });
  });
});
