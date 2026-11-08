
import { PromptBuilder } from '../prompts/PromptBuilder';
import { GenerationExecutor } from './GenerationExecutor';
import { clampScoreToValidRange, clampConfidenceToValidRange } from '../../domain/predicates/ScoreRangeGuard';
import { truncateForAbVariantPreview } from '../../domain/validation/ContentBodyValidator';
import {
  calculateImprovementPercentage,
  selectHigherScoreVariantId,
} from '../../domain/calculations/AbTestImprovementRatio';
import { AB_TEST_DEFAULT_CONFIDENCE } from '../../domain/predicates/AbTestConfidence';
import type {
  ABTestRequest,
  ABTestPrediction,
  ABTestComparison,
} from '../../domain/entities/ABTesting';

const DEFAULT_PREDICTION: ABTestPrediction = {
  variantId: '',
  predictedEngagement: 0,
  predictedCTR: 0,
  predictedConversions: 0,
  confidence: 0,
  reasoning: '',
  strengths: [],
  weaknesses: [],
  suggestions: [],
};

const VARIANT_A_ID = 'A';
const VARIANT_B_ID = 'B';
const FALLBACK_ENGAGEMENT = 50;
const DEFAULT_RECOMMENDATIONS: ReadonlyArray<string> = [
  'Test with larger audience',
  'Monitor click-through rates',
];

export class ABTestService {
  constructor(private readonly executor: GenerationExecutor) {}

  async predictABTest(request: ABTestRequest): Promise<ABTestPrediction[]> {
    const predictions: ABTestPrediction[] = [];
    for (const variant of request.variants) {
      const prompt = PromptBuilder.abTestVariant({
        content: truncateForAbVariantPreview(variant.content),
        contentType: variant.contentType,
        tone: variant.tone,
        targetAudience: request.targetAudience,
        platform: request.platform,
        goals: request.goals,
      });

      const parsed = await this.executor.runJson<ABTestPrediction>(
        prompt,
        { ...DEFAULT_PREDICTION, variantId: variant.id },
        { maxTokens: 300, temperature: 0.5 },
      );

      predictions.push({
        variantId: variant.id,
        predictedEngagement: clampScoreToValidRange(parsed.predictedEngagement),
        predictedCTR: clampScoreToValidRange(parsed.predictedCTR),
        predictedConversions: clampScoreToValidRange(parsed.predictedConversions),
        confidence: clampConfidenceToValidRange(parsed.confidence),
        reasoning: parsed.reasoning ?? '',
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
        suggestions: parsed.suggestions ?? [],
      });
    }
    return predictions;
  }

  async compareVariants(variantA: string, variantB: string): Promise<ABTestComparison> {
    const predictions = await this.predictABTest({
      variants: [
        { id: VARIANT_A_ID, content: variantA, contentType: 'social', tone: 'casual' },
        { id: VARIANT_B_ID, content: variantB, contentType: 'social', tone: 'casual' },
      ],
      targetAudience: 'general',
      platform: 'twitter',
      goals: ['engagement', 'clicks'],
    });

    const scoreA = predictions[0]?.predictedEngagement ?? FALLBACK_ENGAGEMENT;
    const scoreB = predictions[1]?.predictedEngagement ?? FALLBACK_ENGAGEMENT;
    const winner = selectHigherScoreVariantId(scoreA, scoreB, VARIANT_A_ID, VARIANT_B_ID);
    const improvement = calculateImprovementPercentage(scoreA, scoreB);

    return {
      winner,
      confidence: AB_TEST_DEFAULT_CONFIDENCE,
      improvement: `+${improvement}% engagement`,
      reasoning:
        winner === VARIANT_A_ID
          ? 'Variant A has more engaging content'
          : 'Variant B has more engaging content',
      recommendations: [...DEFAULT_RECOMMENDATIONS],
    };
  }
}
