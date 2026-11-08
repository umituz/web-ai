import { describe, expect, it } from 'vitest';
import {
  splitMarkdown,
  deriveSnippetTitle,
} from '../../src/core/markdown/markdown-parser';

describe('splitMarkdown', () => {
  it('returns text segment for plain markdown', () => {
    const text = 'Here is some explanation without code.';
    const segments = splitMarkdown(text);
    expect(segments).toEqual([{ kind: 'text', text }]);
  });

  it('splits text and code blocks with languages', () => {
    const source = 'Intro\n```typescript\nconst x = 1;\n```\nOutro';
    const segments = splitMarkdown(source);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({ kind: 'text', text: 'Intro\n' });
    expect(segments[1]).toEqual({ kind: 'code', text: 'const x = 1;\n', language: 'typescript' });
    expect(segments[2]).toEqual({ kind: 'text', text: '\nOutro' });
  });

  it('handles in-flight unclosed code fence during streaming', () => {
    const source = 'Start\n```python\nprint("streaming...")';
    const segments = splitMarkdown(source);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ kind: 'text', text: 'Start\n' });
    expect(segments[1]).toEqual({ kind: 'code', text: 'print("streaming...")', language: 'python' });
  });
});

describe('deriveSnippetTitle', () => {
  it('strips comment prefixes from the first line', () => {
    expect(deriveSnippetTitle('// User Authentication Service\nexport class Auth {}')).toBe('User Authentication Service');
    expect(deriveSnippetTitle('# Database schema definition\nCREATE TABLE users;')).toBe('Database schema definition');
    expect(deriveSnippetTitle('/* Config parser */\nexport const config = {};')).toBe('Config parser');
  });

  it('returns fallback for blank input', () => {
    expect(deriveSnippetTitle('')).toBe('Snippet');
    expect(deriveSnippetTitle('   \n\n  ')).toBe('Snippet');
  });

  it('truncates long titles with an ellipsis', () => {
    const long = 'a'.repeat(80);
    const title = deriveSnippetTitle(`// ${long}`);
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith('…')).toBe(true);
  });
});
