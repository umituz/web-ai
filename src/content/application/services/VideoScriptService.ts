
import { PromptBuilder } from '../prompts/PromptBuilder';
import { GenerationExecutor } from './GenerationExecutor';
import { validateTopicText } from '../../domain/validation/TopicTextValidator';
import { validateDurationSeconds } from '../../domain/validation/DurationSecondsValidator';
import { estimateTokenBudgetForDuration } from '../../domain/calculations/SpeechPaceEstimate';
import type {
  VideoScriptRequest,
  GeneratedVideoScript,
} from '../../domain/entities/ContentGeneration';
import type { Emotion } from '../../domain/types';

const buildScriptResult = (
  parsed: Partial<GeneratedVideoScript>,
  duration: number,
): GeneratedVideoScript => {
  const script = parsed.script ?? '';
  if (!script) {
    throw new Error('AI response missing script field');
  }
  const wordCount = script.trim().length === 0 ? 0 : script.trim().split(/\s+/).length;
  return {
    ...parsed,
    script,
    duration,
    wordCount,
  } as GeneratedVideoScript;
};

export class VideoScriptService {
  constructor(private readonly executor: GenerationExecutor) {}

  async generateVideoScript(request: VideoScriptRequest): Promise<GeneratedVideoScript> {
    const topic = validateTopicText(request.topic);
    const duration = validateDurationSeconds(request.duration);

    const prompt = PromptBuilder.videoScript({
      topic,
      tone: request.tone,
      duration,
      targetAudience: request.targetAudience,
      includeVisuals: request.includeVisuals,
      includeCallToAction: request.includeCallToAction,
    });

    const parsed = await this.executor.runJson<GeneratedVideoScript>(
      prompt,
      { script: '', visualCues: [], duration, wordCount: 0, estimatedEngagement: 0 },
      { maxTokens: estimateTokenBudgetForDuration(duration), temperature: 0.8 },
    );

    return buildScriptResult(parsed, duration);
  }

  async generateVoiceScript(topic: string, emotion: Emotion, duration: number): Promise<GeneratedVideoScript> {
    const validatedTopic = validateTopicText(topic);
    const validatedDuration = validateDurationSeconds(duration);

    const prompt = PromptBuilder.voiceScript({
      topic: validatedTopic,
      emotion,
      duration: validatedDuration,
    });

    const parsed = await this.executor.runJson<GeneratedVideoScript>(
      prompt,
      { script: '', visualCues: [], duration: validatedDuration, wordCount: 0, estimatedEngagement: 0 },
      { maxTokens: estimateTokenBudgetForDuration(validatedDuration), temperature: 0.8 },
    );

    return buildScriptResult(parsed, validatedDuration);
  }
}
