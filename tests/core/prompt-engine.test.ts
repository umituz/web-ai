import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT_VERSION, buildSystemPrompt } from '../../src/core/prompt/prompt-engine';

describe('buildSystemPrompt', () => {
  it('includes the identity and the current date', () => {
    const prompt = buildSystemPrompt({ now: new Date('2026-11-08T12:00:00Z') });
    expect(prompt).toContain('Current date: 2026-11-08');
  });

  it('appends workspace instructions when systemExtra is set', () => {
    const prompt = buildSystemPrompt({ settings: { systemExtra: 'Answer in Turkish.' } });
    expect(prompt).toContain('Answer in Turkish.');
  });

  it('ignores blank systemExtra', () => {
    const prompt = buildSystemPrompt({ settings: { systemExtra: '   ' } });
    expect(prompt).not.toContain('Workspace instructions');
  });

  it('injects project instructions with the project name', () => {
    const prompt = buildSystemPrompt({
      project: { name: 'Nova App', instructions: 'Always answer in Kotlin.' },
    });
    expect(prompt).toContain('project "Nova App"');
    expect(prompt).toContain('Always answer in Kotlin.');
  });

  it('ignores a project without instructions', () => {
    const prompt = buildSystemPrompt({ project: { name: 'Nova App', instructions: '   ' } });
    expect(prompt).not.toContain('Nova App');
  });

  it('injects agent instructions with the agent name', () => {
    const prompt = buildSystemPrompt({
      agent: { name: 'Research buddy', instructions: 'Always cite sources.' },
    });
    expect(prompt).toContain('agent "Research buddy"');
    expect(prompt).toContain('Always cite sources.');
  });

  it('ignores an agent without instructions', () => {
    const prompt = buildSystemPrompt({ agent: { name: 'Silent', instructions: '' } });
    expect(prompt).not.toContain('Silent');
  });

  it('injects memories and attachments in their own blocks', () => {
    const prompt = buildSystemPrompt({
      memories: ['Prefers concise answers'],
      attachments: [{ name: 'notes.txt', text: 'meeting at noon' }],
    });
    expect(prompt).toContain('- Prefers concise answers');
    expect(prompt).toContain('begin attachment: notes.txt');
    expect(prompt).toContain('meeting at noon');
  });
});

describe('SYSTEM_PROMPT_VERSION', () => {
  it('is pinned', () => {
    expect(SYSTEM_PROMPT_VERSION).toBe(2);
  });
});
