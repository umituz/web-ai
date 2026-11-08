
import { PromptBuilder } from '../prompts/PromptBuilder';
import { GenerationExecutor } from './GenerationExecutor';
import { validateTopicText } from '../../domain/validation/TopicTextValidator';
import { validateCalendarDays } from '../../domain/validation/CalendarDaysValidator';
import { estimateTokenBudgetForCalendarDays } from '../../domain/calculations/SpeechPaceEstimate';
import { resolveCalendarEntryDate } from '../../domain/calculations/ContentCalendarDateOffset';
import type { ContentCalendarEntry } from '../../domain/entities/ContentGeneration';
import type { ContentType, SocialPlatform } from '../../domain/types';

interface CalendarItem {
  day: number;
  topic: string;
  contentType: ContentType;
  platform: SocialPlatform;
  description: string;
  estimatedEngagement: number;
  priority: 'high' | 'medium' | 'low';
}

const toCalendarEntry = (item: CalendarItem): ContentCalendarEntry => ({
  date: resolveCalendarEntryDate(item.day),
  topic: item.topic,
  contentType: item.contentType,
  platform: item.platform,
  description: item.description,
  estimatedEngagement: item.estimatedEngagement,
  priority: item.priority,
});

export class ContentCalendarService {
  constructor(private readonly executor: GenerationExecutor) {}

  async generateContentCalendar(niche: string, days: number): Promise<ContentCalendarEntry[]> {
    const validatedNiche = validateTopicText(niche);
    const validatedDays = validateCalendarDays(days);

    const prompt = PromptBuilder.contentCalendar(validatedNiche, validatedDays);
    const data = await this.executor.runJson<CalendarItem[]>(prompt, [], {
      maxTokens: estimateTokenBudgetForCalendarDays(validatedDays),
      temperature: 0.8,
    });

    return data.map(toCalendarEntry);
  }
}
