/**
 * Content-generation layer ported from web-ai-content: the pure domain, the
 * nine application services, PromptBuilder, and the GenerationExecutor seam.
 * Wizards live in the `./wizard` entry, React hooks in `./hooks`.
 */

export type {
  SocialPlatform,
  ContentTone,
  ContentType,
  Emotion,
  Sentiment,
  BlogType,
  PlatformSpecs,
  PLATFORM_SPECS,
} from './domain/types';
export type {
  ProviderConfig,
  ProviderHealth,
  ProviderType,
  BaseProviderConfig,
  GroqConfig,
  FalConfig,
  PrunaConfig,
  GeminiConfig,
  GenerationRequest,
  TextGenerationRequest,
  ImageGenerationRequest,
  VideoGenerationRequest,
  ImageToVideoRequest,
  VideoToVideoRequest,
  GeneratedContent,
} from './domain/config/ProviderConfig';

export type {
  GenerationType,
  ImageQuality,
  VideoQuality,
  AspectRatio,
  GenerationStatus,
  ImageGenerationInput,
  VideoGenerationInput,
  GenerationResult as ContentGenerationResult,
  GenerationMetadata,
  GenerationProgress,
  CreditCost,
} from './domain/types/GenerationTypes';
export { GENERATION_COSTS, calculateCreditCost } from './domain/types/GenerationTypes';

export {
  ASPECT_RATIO_VALUES,
  IMAGE_QUALITY_VALUES,
  VIDEO_QUALITY_VALUES,
  VIDEO_DURATION_OPTIONS,
  MOTION_OPTIONS,
  STYLE_PRESETS,
  getDimensionsForAspectRatio,
  getRecommendedQuality,
} from './domain/constants/GenerationConstants';
export {
  ASPECT_RATIO_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  VIDEO_QUALITY_OPTIONS,
  VIDEO_DURATION_OPTIONS_SECONDS,
} from './domain/limits/ImageFormatOptions';

export type {
  BlogGenerationRequest,
  GeneratedBlog,
  SocialContentRequest,
  GeneratedSocialContent,
  VideoScriptRequest,
  GeneratedVideoScript,
  ContentCalendarEntry,
} from './domain/entities/ContentGeneration';
export type {
  ContentAnalysisRequest,
  ContentAnalysisResult,
  SentimentAnalysisResult,
} from './domain/entities/SentimentAnalysis';
export type {
  SEOOptimizationRequest,
  SEOOptimizationResult,
  SEOScoreBreakdown,
  KeywordAnalysis,
} from './domain/entities/SEO';
export type {
  ABTestRequest,
  ABTestPrediction,
  ABTestComparison,
  ABTestVariant,
} from './domain/entities/ABTesting';

export type { IAIContentService } from './domain/interfaces/IAIContentService';
export type { ITextGenerator, TextGenerationOptions } from './domain/interfaces/ITextGenerator';

export {
  AIError,
  ValidationError,
  ProviderUnavailableError,
  ProviderQuotaExhaustedError,
} from './domain/errors/AIErrors';
export type { AIErrorCode } from './domain/errors/AIErrors';

export { AIContentService } from './application/services/AIContentService';
export { BlogService } from './application/services/BlogService';
export { SocialService } from './application/services/SocialService';
export { VideoScriptService } from './application/services/VideoScriptService';
export { AnalysisService } from './application/services/AnalysisService';
export { SeoService } from './application/services/SeoService';
export { ABTestService } from './application/services/ABTestService';
export { ImagePromptService } from './application/services/ImagePromptService';
export { ContentCalendarService } from './application/services/ContentCalendarService';
export { MediaGenerationService } from './application/services/ProviderServices';
export { GenerationExecutor } from './application/services/GenerationExecutor';

export { PromptBuilder } from './application/prompts/PromptBuilder';
