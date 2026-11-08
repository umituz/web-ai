import { SocialPlatform, ContentTone, Emotion } from '../types';
import {
  BlogGenerationRequest,
  GeneratedBlog,
  SocialContentRequest,
  GeneratedSocialContent,
  VideoScriptRequest,
  GeneratedVideoScript,
  ContentCalendarEntry,
} from '../entities/ContentGeneration';
import {
  ContentAnalysisRequest,
  ContentAnalysisResult,
  SentimentAnalysisResult,
} from '../entities/SentimentAnalysis';
import {
  SEOOptimizationRequest,
  SEOOptimizationResult,
  SEOScoreBreakdown,
  KeywordAnalysis,
} from '../entities/SEO';
import {
  ABTestRequest,
  ABTestPrediction,
  ABTestComparison,
} from '../entities/ABTesting';

export interface IAIContentService {
  generateBlogPost(request: BlogGenerationRequest): Promise<GeneratedBlog>;
  generateSocialContent(request: SocialContentRequest): Promise<GeneratedSocialContent>;
  generateVideoScript(request: VideoScriptRequest): Promise<GeneratedVideoScript>;

  generateForAllPlatforms(topic: string, tone: ContentTone): Promise<GeneratedSocialContent[]>;

  generateContentCalendar(niche: string, days: number): Promise<ContentCalendarEntry[]>;

  analyzeSentiment(content: string): Promise<SentimentAnalysisResult>;
  analyzeContent(request: ContentAnalysisRequest): Promise<ContentAnalysisResult>;

  optimizeSEO(request: SEOOptimizationRequest): Promise<SEOOptimizationResult>;
  calculateSEOScore(content: string, keywords: string[]): Promise<SEOScoreBreakdown>;
  analyzeKeywords(content: string, keywords: string[]): Promise<KeywordAnalysis[]>;

  predictABTest(request: ABTestRequest): Promise<ABTestPrediction[]>;
  compareVariants(variantA: string, variantB: string): Promise<ABTestComparison>;

  generateHashtags(content: string, count: number): Promise<string[]>;
  optimizeHashtags(hashtags: string[], platform: SocialPlatform): Promise<string[]>;

  generateImagePrompt(description: string, style: string): Promise<string>;
  generateImagePromptsForBlog(blogContent: string): Promise<string[]>;

  generateVoiceScript(
    topic: string,
    emotion: Emotion,
    duration: number
  ): Promise<GeneratedVideoScript>;
}
