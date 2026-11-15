import { describe, expect, it } from 'vitest';
import { deriveConversationTitle } from '../../src/core/utils/title';

describe('deriveConversationTitle', () => {
  it('takes the first non-empty line and collapses whitespace', () => {
    expect(deriveConversationTitle('\n\n  Hello   world \nsecond line')).toBe('Hello world');
  });

  it('strips Markdown heading and list prefixes', () => {
    expect(deriveConversationTitle('## Fix the login bug')).toBe('Fix the login bug');
    expect(deriveConversationTitle('- Remind me about the deploy')).toBe('Remind me about the deploy');
    expect(deriveConversationTitle('> Quoted opening')).toBe('Quoted opening');
  });

  it('truncates long titles with an ellipsis at the boundary', () => {
    const title = deriveConversationTitle('a'.repeat(80));
    expect(title).toBe(`${'a'.repeat(60)}…`);
  });

  it('respects a custom max length', () => {
    expect(deriveConversationTitle('abcdefgh', { maxChars: 3 })).toBe('abc…');
  });

  it('returns the fallback for empty or blank content', () => {
    expect(deriveConversationTitle('', { fallback: 'New conversation' })).toBe('New conversation');
    expect(deriveConversationTitle('   \n  \t', { fallback: 'New conversation' })).toBe('New conversation');
    expect(deriveConversationTitle('')).toBe('');
  });
});
