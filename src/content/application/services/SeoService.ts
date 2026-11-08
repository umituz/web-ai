
import { PromptBuilder } from '../prompts/PromptBuilder';
import { GenerationExecutor } from './GenerationExecutor';
import { validateContentBody, truncateForSeoPreview } from '../../domain/validation/ContentBodyValidator';
import { validateKeywordList } from '../../domain/validation/KeywordListValidator';
import { clampScoreToValidRange } from '../../domain/predicates/ScoreRangeGuard';
import {
  calculateKeywordDensity,
  countKeywordOccurrences,
  countWordsInContent,
} from '../../domain/calculations/SeoKeywordDensity';
import { classifyKeywordProminence, isUnderutilizedKeyword } from '../../domain/predicates/KeywordProminenceClassifier';
import type {
  SEOOptimizationRequest,
  SEOOptimizationResult,
  SEOScoreBreakdown,
  KeywordAnalysis,
} from '../../domain/entities/SEO';

const DEFAULT_SEO_SCORE: SEOScoreBreakdown = {
  keywordDensity: 50,
  readabilityScore: 50,
  titleOptimization: 50,
  metaDescription: 50,
  headingStructure: 50,
  internalLinking: 50,
  overall: 50,
};

const UNDERUTILIZED_SUGGESTION = 'Consider using this keyword more frequently';

export class SeoService {
  constructor(private readonly executor: GenerationExecutor) {}

  async optimizeSEO(request: SEOOptimizationRequest): Promise<SEOOptimizationResult> {
    const content = validateContentBody(request.content);
    const keywords = validateKeywordList(request.keywords);

    const prompt = PromptBuilder.seoOptimization(content, keywords);
    const result = await this.executor.runJson<SEOOptimizationResult>(
      prompt,
      {
        optimized: content,
        score: 50,
        suggestions: [],
        addedKeywords: [],
        removedFillerWords: 0,
        readabilityImprovements: [],
      },
      { maxTokens: 1000, temperature: 0.7 },
    );

    return {
      ...result,
      score: clampScoreToValidRange(result.score),
    };
  }

  async calculateSEOScore(content: string, keywords: string[]): Promise<SEOScoreBreakdown> {
    const validatedContent = validateContentBody(content);
    const validatedKeywords = validateKeywordList(keywords);

    const prompt = PromptBuilder.seoOptimization(
      truncateForSeoPreview(validatedContent),
      validatedKeywords,
    );
    const result = await this.executor.runJson<SEOScoreBreakdown>(
      prompt,
      DEFAULT_SEO_SCORE,
      { maxTokens: 200, temperature: 0.3 },
    );

    return {
      keywordDensity: clampScoreToValidRange(result.keywordDensity),
      readabilityScore: clampScoreToValidRange(result.readabilityScore),
      titleOptimization: clampScoreToValidRange(result.titleOptimization),
      metaDescription: clampScoreToValidRange(result.metaDescription),
      headingStructure: clampScoreToValidRange(result.headingStructure),
      internalLinking: clampScoreToValidRange(result.internalLinking),
      overall: clampScoreToValidRange(result.overall),
    };
  }

  analyzeKeywords(content: string, keywords: string[]): KeywordAnalysis[] {
    const validatedContent = validateContentBody(content);
    const validatedKeywords = validateKeywordList(keywords);
    void countWordsInContent(validatedContent);

    return validatedKeywords.map((keyword) => {
      const count = countKeywordOccurrences(validatedContent, keyword);
      const density = calculateKeywordDensity(validatedContent, keyword);
      return {
        keyword,
        count,
        density,
        prominence: classifyKeywordProminence(density),
        suggestions: isUnderutilizedKeyword(density) ? [UNDERUTILIZED_SUGGESTION] : [],
      };
    });
  }
}
