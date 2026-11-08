
import { PromptBuilder } from '../prompts/PromptBuilder';
import { GenerationExecutor } from './GenerationExecutor';
import { batchRequest } from '../../infrastructure/utils/requestQueue';
import { validateTopicText } from '../../domain/validation/TopicTextValidator';
import { validateHashtagCount } from '../../domain/validation/HashtagCountValidator';
import {
  resolvePlatformSpec,
  resolveMaxContentLength,
  rankAndTrimHashtags,
  resolveHashtagBudget,
} from '../../domain/predicates';
import type {
  SocialContentRequest,
  GeneratedSocialContent,
} from '../../domain/entities/ContentGeneration';
import type { ContentTone, SocialPlatform } from '../../domain/types';

const MULTI_PLATFORMS: ReadonlyArray<SocialPlatform> = [
  'twitter',
  'linkedin',
  'instagram',
  'threads',
  'tiktok',
];

const DEFAULT_SOCIAL_RESULT: GeneratedSocialContent = {
  content: '',
  platform: 'twitter',
  hashtags: [],
  emojis: [],
  characterCount: 0,
  estimatedEngagement: 0,
};

export class SocialService {
  constructor(private readonly executor: GenerationExecutor) {}

  async generateSocialContent(request: SocialContentRequest): Promise<GeneratedSocialContent> {
    const topic = validateTopicText(request.topic);
    const spec = resolvePlatformSpec(request.platform);
    const maxLength = resolveMaxContentLength(request.platform, request.maxLength);

    const prompt = PromptBuilder.socialPost({
      topic,
      platform: request.platform,
      tone: request.tone,
      style: spec.style,
      maxLength,
      includeHashtags: request.hashtags !== false,
      includeCallToAction: Boolean(request.includeCallToAction),
    });

    const parsed = await this.executor.runJson<GeneratedSocialContent>(
      prompt,
      { ...DEFAULT_SOCIAL_RESULT, platform: request.platform },
      { maxTokens: 500, temperature: 0.8 },
    );

    return {
      ...parsed,
      platform: request.platform,
      characterCount: parsed.content?.length ?? 0,
    };
  }

  async generateForAllPlatforms(topic: string, tone: ContentTone): Promise<GeneratedSocialContent[]> {
    const requests = MULTI_PLATFORMS.map((platform) => () =>
      this.generateSocialContent({ topic, platform, tone }),
    );

    try {
      return await batchRequest(requests, { concurrency: 2, stopOnError: false });
    } catch (error) {
      console.warn('Batch execution failed, falling back to sequential:', error);
      const results: GeneratedSocialContent[] = [];
      for (const platform of MULTI_PLATFORMS) {
        try {
          results.push(await this.generateSocialContent({ topic, platform, tone }));
        } catch (err) {
          console.error(`Failed to generate for ${platform}:`, err);
        }
      }
      return results;
    }
  }

  async generateHashtags(content: string, count: number): Promise<string[]> {
    const validated = validateHashtagCount(count);
    const prompt = PromptBuilder.hashtags(content, validated);
    const response = await this.executor.runText(prompt, { maxTokens: 200, temperature: 0.7 });
    const hashtags = response.match(/#[\w-]+/g) || [];
    return hashtags.slice(0, validated);
  }

  optimizeHashtags(hashtags: string[], platform: SocialPlatform): string[] {
    const budget = resolveHashtagBudget(platform);
    return rankAndTrimHashtags(hashtags, budget);
  }
}
