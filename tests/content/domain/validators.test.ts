import { describe, expect, it } from 'vitest';
import {
  validateCalendarDays,
  validateContentBody,
  validateDurationSeconds,
  validateHashtagCount,
  validateKeywordList,
  validateTopicText,
  truncateForSeoPreview,
} from '../../../src/content/domain/validation';
import { ValidationError } from '../../../src/content/domain/errors/AIErrors';
import { ValidationLimits } from '../../../src/content/domain/limits/ValidationLimits';

describe('validateTopicText', () => {
  it('trims and returns a valid topic', () => {
    expect(validateTopicText('  AI trends  ')).toBe('AI trends');
  });

  it('rejects empty and whitespace-only topics', () => {
    expect(() => validateTopicText('')).toThrow(ValidationError);
    expect(() => validateTopicText('   ')).toThrow(ValidationError);
  });

  it('rejects topics above the maximum length', () => {
    expect(() => validateTopicText('a'.repeat(ValidationLimits.TOPIC.MAX + 1))).toThrow(ValidationError);
  });

  it('accepts a topic exactly at the boundary', () => {
    expect(validateTopicText('a'.repeat(ValidationLimits.TOPIC.MAX))).toHaveLength(ValidationLimits.TOPIC.MAX);
  });
});

describe('validateContentBody', () => {
  it('trims and returns valid content', () => {
    expect(validateContentBody('  hello world  ')).toBe('hello world');
  });

  it('rejects empty content', () => {
    expect(() => validateContentBody('   ')).toThrow(ValidationError);
  });

  it('rejects content beyond the maximum length', () => {
    expect(() => validateContentBody('x'.repeat(ValidationLimits.CONTENT.MAX + 1))).toThrow(ValidationError);
  });
});

describe('validateKeywordList', () => {
  it('trims, dedupes blanks, and returns cleaned keywords', () => {
    expect(validateKeywordList([' ai ', 'ml', '', '   '])).toEqual(['ai', 'ml']);
  });

  it('rejects non-array input', () => {
    expect(() => validateKeywordList('not-an-array')).toThrow(ValidationError);
  });

  it('rejects more than the maximum count', () => {
    const tooMany = Array.from({ length: ValidationLimits.KEYWORD.MAX_COUNT + 1 }, () => 'k');
    expect(() => validateKeywordList(tooMany)).toThrow(ValidationError);
  });

  it('rejects a keyword beyond the maximum length', () => {
    expect(() => validateKeywordList(['a'.repeat(ValidationLimits.KEYWORD.MAX_LENGTH + 1)])).toThrow(ValidationError);
  });
});

describe('validateDurationSeconds', () => {
  it('accepts durations within range', () => {
    expect(validateDurationSeconds(30)).toBe(30);
    expect(validateDurationSeconds(ValidationLimits.DURATION_SECONDS.MIN)).toBe(ValidationLimits.DURATION_SECONDS.MIN);
    expect(validateDurationSeconds(ValidationLimits.DURATION_SECONDS.MAX)).toBe(ValidationLimits.DURATION_SECONDS.MAX);
  });

  it('rejects out-of-range and non-finite durations', () => {
    expect(() => validateDurationSeconds(0)).toThrow(ValidationError);
    expect(() => validateDurationSeconds(Infinity)).toThrow(ValidationError);
    expect(() => validateDurationSeconds(Number.NaN)).toThrow(ValidationError);
  });
});

describe('validateCalendarDays', () => {
  it('accepts days within range', () => {
    expect(validateCalendarDays(7)).toBe(7);
  });

  it('rejects out-of-range days', () => {
    expect(() => validateCalendarDays(0)).toThrow(ValidationError);
    expect(() => validateCalendarDays(ValidationLimits.CALENDAR_DAYS.MAX + 1)).toThrow(ValidationError);
  });
});

describe('validateHashtagCount', () => {
  it('accepts and floors counts within range', () => {
    expect(validateHashtagCount(5)).toBe(5);
    expect(validateHashtagCount(5.9)).toBe(5);
  });

  it('rejects out-of-range counts', () => {
    expect(() => validateHashtagCount(0)).toThrow(ValidationError);
    expect(() => validateHashtagCount(ValidationLimits.HASHTAG_COUNT.MAX + 1)).toThrow(ValidationError);
  });
});

describe('truncateForSeoPreview', () => {
  it('truncates to the configured preview length', () => {
    const long = 'x'.repeat(ValidationLimits.SEO_CONTENT_PREVIEW + 100);
    expect(truncateForSeoPreview(long)).toHaveLength(ValidationLimits.SEO_CONTENT_PREVIEW);
  });

  it('leaves short content untouched', () => {
    expect(truncateForSeoPreview('short')).toBe('short');
  });
});
