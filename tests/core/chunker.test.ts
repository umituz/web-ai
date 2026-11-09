import { describe, expect, it } from 'vitest';
import { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS, chunkText } from '../../src/core/parsers/chunker';

describe('chunkText basics', () => {
  it('returns no chunks for blank input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('keeps a short document as one chunk', () => {
    const text = 'Only paragraph.';
    expect(chunkText(text)).toEqual([text]);
  });

  it('merges small paragraphs up to the limit', () => {
    const chunks = chunkText(
      Array.from({ length: 80 }, (_, i) => `Paragraph ${i} with some words.`).join('\n\n'),
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(80);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    }
  });
});

describe('chunkText splitting', () => {
  it('splits a long single paragraph on sentence boundaries', () => {
    const sentence = 'This is one measured sentence that keeps going and going. ';
    const text = sentence.repeat(80);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    }
    expect(chunks[0]?.endsWith('.')).toBe(true);
  });

  it('overflows carry context into the next chunk', () => {
    const sentence = 'Sentence number something with padding words. ';
    const text = sentence.repeat(60);
    const chunks = chunkText(text);
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i]?.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    }
    expect(chunks.length).toBeGreaterThan(2);
  });

  it('respects custom sizes', () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(text, { maxChars: 120, overlapChars: 20 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(120);
    }
  });

  it('keeps every character of a word-only document reachable across chunks', () => {
    const words = Array.from({ length: 300 }, (_, i) => `token${i}`);
    const text = words.join(' ');
    const chunks = chunkText(text, { maxChars: 400, overlapChars: 50 });
    const tail = chunks[chunks.length - 1];
    expect(tail).toContain('token299');
    expect(chunks[0]).toContain('token0');
    expect(chunks[0]?.length).toBeLessThanOrEqual(400);
  });
});

describe('chunkText options hygiene', () => {
  it('caps overlap at half the chunk size', () => {
    const text = 'word '.repeat(500);
    const chunks = chunkText(text, { maxChars: 100, overlapChars: 5000 });
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  it('exposes defaults used by the indexer', () => {
    expect(CHUNK_MAX_CHARS).toBeGreaterThan(0);
    expect(CHUNK_OVERLAP_CHARS).toBeGreaterThan(0);
    expect(CHUNK_OVERLAP_CHARS).toBeLessThan(CHUNK_MAX_CHARS / 2);
  });
});
