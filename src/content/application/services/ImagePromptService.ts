
import { PromptBuilder } from '../prompts/PromptBuilder';
import { GenerationExecutor } from './GenerationExecutor';
import { validateTopicText } from '../../domain/validation/TopicTextValidator';
import { validateContentBody, truncateForBlogPromptPreview } from '../../domain/validation/ContentBodyValidator';

export class ImagePromptService {
  constructor(private readonly executor: GenerationExecutor) {}

  async generateImagePrompt(description: string, style: string): Promise<string> {
    const validated = validateTopicText(description);
    const prompt = PromptBuilder.imagePrompt(validated, style);
    return this.executor.runText(prompt, { maxTokens: 300, temperature: 0.8 });
  }

  async generateImagePromptsForBlog(blogContent: string): Promise<string[]> {
    const truncated = truncateForBlogPromptPreview(validateContentBody(blogContent));
    const prompt = PromptBuilder.blogImagePrompts(truncated);

    const prompts = await this.executor.runJson<string[]>(prompt, [], {
      maxTokens: 500,
      temperature: 0.8,
    });
    return Array.isArray(prompts) ? prompts : [];
  }
}
