import { describe, expect, it } from 'vitest';
import {
  isTextLike,
  extractText,
  capText,
} from '../../src/core/parsers/text-extract';

describe('text-extract', () => {
  it('identifies text-like files by mime type or extension', () => {
    expect(isTextLike('text/plain', 'notes')).toBe(true);
    expect(isTextLike('application/json', 'payload')).toBe(true);
    expect(isTextLike('application/octet-stream', 'code.py')).toBe(true);
    expect(isTextLike('application/octet-stream', 'archive.zip')).toBe(false);
  });

  it('extracts UTF-8 text from bytes and strips null characters', () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode('Hello\0World!');
    expect(extractText(bytes)).toBe('HelloWorld!');
  });

  it('caps text and appends truncated marker when exceeding limit', () => {
    expect(capText('short', 10)).toBe('short');
    const capped = capText('a'.repeat(20), 10);
    expect(capped).toBe(`${'a'.repeat(10)}\n[truncated]`);
  });
});
