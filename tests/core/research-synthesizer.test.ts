import { describe, expect, it } from 'vitest';
import {
  normalizeSources,
  buildResearchMessages,
  accumulateReport,
  type ResearchSource,
  type ResearchStreamEvent,
} from '../../src/core/research/research-synthesizer';

describe('research-synthesizer', () => {
  it('normalizeSources truncates snippets and falls back to URL when title is missing', () => {
    const raw = [
      { title: '', url: 'https://example.com/doc', content: 'x'.repeat(1500), score: null },
      { title: 'Short', url: 'https://example.com/short', content: 'snippet', score: 0.9 },
    ];
    const sources = normalizeSources(raw, 500);
    expect(sources).toHaveLength(2);
    expect(sources[0]?.title).toBe('https://example.com/doc');
    expect(sources[0]?.snippet.length).toBeLessThanOrEqual(501);
    expect(sources[0]?.snippet.endsWith('…')).toBe(true);
    expect(sources[1]?.title).toBe('Short');
  });

  it('buildResearchMessages constructs numbered source references and question block', () => {
    const sources: ResearchSource[] = [
      { title: 'Doc A', url: 'https://a.com', snippet: 'content A' },
      { title: 'Doc B', url: 'https://b.com', snippet: 'content B' },
    ];
    const messages = buildResearchMessages('What is quantum computing?', sources);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('[1] or [2]');
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toContain('[1] Doc A');
    expect(messages[1]?.content).toContain('[2] Doc B');
    expect(messages[1]?.content).toContain('What is quantum computing?');
  });

  it('accumulateReport gathers answer deltas and usage while rejecting unexpected tool calls', async () => {
    async function* validStream(): AsyncIterable<ResearchStreamEvent> {
      yield { type: 'delta', channel: 'answer', text: 'Quantum ' };
      yield { type: 'delta', channel: 'answer', text: 'supremacy.' };
      yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 20 } };
    }

    const result = await accumulateReport(validStream());
    expect(result.report).toBe('Quantum supremacy.');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 20 });

    async function* invalidStream(): AsyncIterable<ResearchStreamEvent> {
      yield { type: 'delta', channel: 'answer', text: 'part' };
      yield { type: 'tool_calls' };
    }

    await expect(accumulateReport(invalidStream())).rejects.toThrow('unexpected tool calls');
  });
});
