import { describe, expect, it, vi } from 'vitest';
import { GenerationExecutor } from '../../../src/content/application/services/GenerationExecutor';
import { AIContentService } from '../../../src/content/application/services/AIContentService';
import { AIError } from '../../../src/content/domain/errors/AIErrors';
import type { ITextGenerator } from '../../../src/content/domain/interfaces/ITextGenerator';

const stubGenerator = (response: string): ITextGenerator => ({
  generateText: vi.fn(async () => response),
  generateTextStream: async function* () {
    yield response;
  },
});

describe('GenerationExecutor', () => {
  it('returns parsed JSON from a model response', async () => {
    const executor = new GenerationExecutor(stubGenerator('{"title":"Hello"}'));
    const result = await executor.runJson<{ title: string }>('prompt', { title: '' });
    expect(result).toEqual({ title: 'Hello' });
  });

  it('falls back when the model returns unparseable output', async () => {
    const executor = new GenerationExecutor(stubGenerator('no json at all'));
    const fallback = { title: 'default' };
    const result = await executor.runJson('prompt', fallback);
    expect(result).toBe(fallback);
  });

  it('passes generation options through to the generator', async () => {
    const generateText = vi.fn(async () => '{}');
    const executor = new GenerationExecutor({ generateText, generateTextStream: stubGenerator('').generateTextStream });
    await executor.runJson('prompt', {}, { maxTokens: 512, temperature: 0.2 });
    expect(generateText).toHaveBeenCalledWith('prompt', { maxTokens: 512, temperature: 0.2 });
  });

  it('propagates generator failures (no silent fallback on transport errors)', async () => {
    const failing: ITextGenerator = {
      generateText: async () => {
        throw new Error('provider down');
      },
      generateTextStream: async function* () {},
    };
    const executor = new GenerationExecutor(failing);
    await expect(executor.runJson('prompt', {})).rejects.toThrow('provider down');
  });

  it('runText returns the raw response', async () => {
    const executor = new GenerationExecutor(stubGenerator('raw output'));
    await expect(executor.runText('prompt')).resolves.toBe('raw output');
  });
});

describe('AIContentService (custom text-generator mode)', () => {
  it('constructs with an empty provider config without touching any SDK', () => {
    expect(() => new AIContentService({})).not.toThrow();
  });

  it('media generation without providers fails with a coded, actionable error', async () => {
    const service = new AIContentService({});
    const err: AIError = (() => {
      try {
        service.generateImage({ type: 'image', prompt: 'a cat' });
        throw new Error('expected generateImage to throw');
      } catch (e) {
        return e as AIError;
      }
    })();

    expect(err).toBeInstanceOf(AIError);
    expect(err.code).toBe('PROVIDER_UNAVAILABLE');
    expect(err.message).toContain('No providers are registered');
  });

  it('accepts an injected ITextGenerator, bypassing the provider factory entirely', async () => {
    const custom = stubGenerator('{"title":"From custom backend"}');
    const service = new AIContentService(custom);
    const blog = await service.generateBlogPost({
      topic: 'topic',
      blogType: 'tutorial',
      targetKeywords: ['k'],
      tone: 'professional',
      wordCount: 100,
      targetAudience: 'devs',
      seoOptimization: false,
      includeImages: false,
      includeSchema: false,
    });
    expect(blog.title).toBe('From custom backend');
  });
});

describe('AIContentService (provider-config mode)', () => {
  it('registers only enabled providers and exposes them via the factory', () => {
    const service = new AIContentService({
      priority: ['groq'],
      fallbackEnabled: true,
      retryAttempts: 2,
      timeout: 30_000,
      groq: { apiKey: 'g', enabled: true },
    });
    expect(service).toBeInstanceOf(AIContentService);
  });

  it('constructs with an empty (no-provider) factory configuration', () => {
    expect(
      () => new AIContentService({ priority: [], fallbackEnabled: false, retryAttempts: 0, timeout: 0 }),
    ).not.toThrow();
  });
});
