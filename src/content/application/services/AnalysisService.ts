
import { PromptBuilder } from '../prompts/PromptBuilder';
import { GenerationExecutor } from './GenerationExecutor';
import { validateContentBody } from '../../domain/validation/ContentBodyValidator';
import { clampConfidenceToValidRange, clampScoreToValidRange } from '../../domain/predicates/ScoreRangeGuard';
import type {
  ContentAnalysisRequest,
  ContentAnalysisResult,
  SentimentAnalysisResult,
} from '../../domain/entities/SentimentAnalysis';

const DEFAULT_SENTIMENT: SentimentAnalysisResult = {
  sentiment: 'neutral',
  confidence: 0.5,
  emotions: [],
};

const DEFAULT_ANALYSIS: ContentAnalysisResult = {
  sentiment: DEFAULT_SENTIMENT,
  keywords: [],
  entities: [],
  suggestedImprovements: [],
  readabilityScore: 50,
  estimatedEngagement: 50,
};

export class AnalysisService {
  constructor(private readonly executor: GenerationExecutor) {}

  async analyzeSentiment(content: string): Promise<SentimentAnalysisResult> {
    const validated = validateContentBody(content);
    const prompt = PromptBuilder.sentiment(validated);

    const result = await this.executor.runJson<SentimentAnalysisResult>(
      prompt,
      DEFAULT_SENTIMENT,
      { maxTokens: 200, temperature: 0.3 },
    );

    return {
      ...result,
      confidence: clampConfidenceToValidRange(result.confidence),
    };
  }

  async analyzeContent(request: ContentAnalysisRequest): Promise<ContentAnalysisResult> {
    const validated = validateContentBody(request.content);
    const sentimentResult = await this.analyzeSentiment(validated);

    const prompt = PromptBuilder.contentAnalysis(validated);
    const parsed = await this.executor.runJson<ContentAnalysisResult>(
      prompt,
      { ...DEFAULT_ANALYSIS, sentiment: sentimentResult },
      { maxTokens: 300, temperature: 0.5 },
    );

    return {
      sentiment: sentimentResult,
      keywords: parsed.keywords ?? [],
      entities: parsed.entities ?? [],
      suggestedImprovements: parsed.suggestedImprovements ?? [],
      readabilityScore: clampScoreToValidRange(parsed.readabilityScore),
      estimatedEngagement: clampScoreToValidRange(parsed.estimatedEngagement),
    };
  }
}
