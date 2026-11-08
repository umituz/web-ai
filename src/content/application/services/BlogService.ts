
import { PromptBuilder } from '../prompts/PromptBuilder';
import { GenerationExecutor } from './GenerationExecutor';
import { validateTopicText } from '../../domain/validation/TopicTextValidator';
import { validateKeywordList } from '../../domain/validation/KeywordListValidator';
import { generateId } from '../../domain/utils/IdGenerator';
import type { BlogGenerationRequest, GeneratedBlog } from '../../domain/entities/ContentGeneration';

export class BlogService {
  constructor(private readonly executor: GenerationExecutor) {}

  async generateBlogPost(request: BlogGenerationRequest): Promise<GeneratedBlog> {
    const topic = validateTopicText(request.topic);
    const keywords = validateKeywordList(request.targetKeywords);

    const prompt = PromptBuilder.blogPost({
      topic,
      blogType: request.blogType,
      keywords,
      tone: request.tone,
      targetAudience: request.targetAudience,
      wordCount: request.wordCount,
      language: request.language,
      seoOptimization: request.seoOptimization,
      includeSchema: request.includeSchema,
      includeImages: request.includeImages,
    });

    const parsed = await this.executor.runJson<Record<string, unknown>>(
      prompt,
      {},
      { maxTokens: request.wordCount * 2, temperature: 0.7 },
    );

    return {
      id: generateId('blog'),
      ...(parsed as Partial<GeneratedBlog>),
      blogType: request.blogType,
      tone: request.tone,
      wordCount: request.wordCount,
      createdAt: new Date().toISOString(),
    } as GeneratedBlog;
  }
}
