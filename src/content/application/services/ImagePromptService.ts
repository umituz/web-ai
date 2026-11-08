
import { PromptBuilder } from '../prompts/PromptBuilder';
import { GenerationExecutor } from './GenerationExecutor';
import { validateTopicText } from '../../domain/validation/TopicTextValidator';
import { validateContentBody, truncateForBlogPromptPreview } from '../../domain/validation/ContentBodyValidator';
import { safeJSONParse } from '../../infrastructure/utils/jsonParser';

const JSON_ARRAY_PATTERN = /\[[\s\S]*\]/;

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

    const response = await this.executor.runText(prompt, { maxTokens: 500, temperature: 0.8 });
    const jsonMatch = response.match(JSON_ARRAY_PATTERN);
    if (!jsonMatch) return [];
    return safeJSONParse<string[]>(jsonMatch[0], []);
  }
}
