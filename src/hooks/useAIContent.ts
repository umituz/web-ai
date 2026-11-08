
import { useCallback, useMemo } from 'react';
import type {
  BlogGenerationRequest,
  GeneratedBlog,
  SocialContentRequest,
  GeneratedSocialContent,
  VideoScriptRequest,
  GeneratedVideoScript,
  ContentCalendarEntry,
} from '../content/domain/entities/ContentGeneration';
import type {
  ContentAnalysisRequest,
  ContentAnalysisResult,
  SentimentAnalysisResult,
} from '../content/domain/entities/SentimentAnalysis';
import type {
  SEOOptimizationRequest,
  SEOOptimizationResult,
  SEOScoreBreakdown,
} from '../content/domain/entities/SEO';
import type {
  ABTestRequest,
  ABTestPrediction,
  ABTestComparison,
} from '../content/domain/entities/ABTesting';
import type { ContentTone, Emotion } from '../content/domain/types';
import type {
  ImageGenerationRequest,
  VideoGenerationRequest,
  ImageToVideoRequest,
  VideoToVideoRequest,
  GeneratedContent,
} from '../content/domain/config/ProviderConfig';
import type { AIErrorCode } from '../content/domain/errors/AIErrors';
import { useAIContentContext, type AIOptionCallbacks, type ContentServiceConfig } from './internal/useAIContentContext';

export interface UseAIContentOptions {
  /** Provider config (AIProviderConfig or legacy ProviderConfig) or a custom ITextGenerator. */
  config?: ContentServiceConfig;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export interface UseAIContentReturn {
  isLoading: boolean;
  progress: number;
  error: string | null;
  errorCode: AIErrorCode | null;

  generateBlogPost: (request: BlogGenerationRequest) => Promise<GeneratedBlog | null>;
  generateSocialContent: (request: SocialContentRequest) => Promise<GeneratedSocialContent | null>;
  generateForAllPlatforms: (topic: string, tone: ContentTone) => Promise<GeneratedSocialContent[]>;
  generateVideoScript: (request: VideoScriptRequest) => Promise<GeneratedVideoScript | null>;
  generateContentCalendar: (niche: string, days: number) => Promise<ContentCalendarEntry[]>;

  analyzeSentiment: (content: string) => Promise<SentimentAnalysisResult | null>;
  analyzeContent: (request: ContentAnalysisRequest) => Promise<ContentAnalysisResult | null>;

  optimizeSEO: (request: SEOOptimizationRequest) => Promise<SEOOptimizationResult | null>;
  calculateSEOScore: (content: string, keywords: string[]) => Promise<SEOScoreBreakdown | null>;

  predictABTest: (request: ABTestRequest) => Promise<ABTestPrediction[]>;
  compareVariants: (variantA: string, variantB: string) => Promise<ABTestComparison | null>;

  generateHashtags: (content: string, count: number) => Promise<string[]>;
  generateImagePrompt: (description: string, style: string) => Promise<string | null>;
  generateVoiceScript: (topic: string, emotion: Emotion, duration: number) => Promise<GeneratedVideoScript | null>;

  generateImage: (request: ImageGenerationRequest) => Promise<GeneratedContent | null>;
  generateVideo: (request: VideoGenerationRequest) => Promise<GeneratedContent | null>;
  convertImageToVideo: (request: ImageToVideoRequest) => Promise<GeneratedContent | null>;
  transformVideo: (request: VideoToVideoRequest) => Promise<GeneratedContent | null>;
}

const stableCallbacks = (opts: UseAIContentOptions): AIOptionCallbacks | undefined => {
  if (!opts.onError && !opts.onProgress) return undefined;
  return { onError: opts.onError, onProgress: opts.onProgress };
};

export function useAIContent(options: UseAIContentOptions): UseAIContentReturn {
  const callbacks = useMemo(() => stableCallbacks(options), [options.onError, options.onProgress]);
  const { service, ctx } = useAIContentContext({
    config: options.config,
    callbacks,
  });

  const generateBlogPost = useCallback(
    (request: BlogGenerationRequest) =>
      ctx.execute(() => service.generateBlogPost(request), 'Failed to generate blog post', { reportProgress: true }),
    [ctx, service],
  );

  const generateSocialContent = useCallback(
    (request: SocialContentRequest) =>
      ctx.execute(() => service.generateSocialContent(request), 'Failed to generate social content'),
    [ctx, service],
  );

  const generateForAllPlatforms = useCallback(
    async (topic: string, tone: ContentTone): Promise<GeneratedSocialContent[]> => {
      const result = await ctx.execute(
        () => service.generateForAllPlatforms(topic, tone),
        'Failed to generate content for all platforms',
      );
      return result ?? [];
    },
    [ctx, service],
  );

  const generateVideoScript = useCallback(
    (request: VideoScriptRequest) =>
      ctx.execute(() => service.generateVideoScript(request), 'Failed to generate video script'),
    [ctx, service],
  );

  const generateContentCalendar = useCallback(
    async (niche: string, days: number): Promise<ContentCalendarEntry[]> => {
      const result = await ctx.execute(
        () => service.generateContentCalendar(niche, days),
        'Failed to generate calendar',
      );
      return result ?? [];
    },
    [ctx, service],
  );

  const analyzeSentiment = useCallback(
    (content: string) => ctx.execute(() => service.analyzeSentiment(content), 'Failed to analyze sentiment'),
    [ctx, service],
  );

  const analyzeContent = useCallback(
    (request: ContentAnalysisRequest) => ctx.execute(() => service.analyzeContent(request), 'Failed to analyze content'),
    [ctx, service],
  );

  const optimizeSEO = useCallback(
    (request: SEOOptimizationRequest) => ctx.execute(() => service.optimizeSEO(request), 'Failed to optimize SEO'),
    [ctx, service],
  );

  const calculateSEOScore = useCallback(
    (content: string, keywords: string[]) =>
      ctx.execute(() => service.calculateSEOScore(content, keywords), 'Failed to calculate SEO score'),
    [ctx, service],
  );

  const predictABTest = useCallback(
    async (request: ABTestRequest): Promise<ABTestPrediction[]> => {
      const result = await ctx.execute(() => service.predictABTest(request), 'Failed to predict A/B test');
      return result ?? [];
    },
    [ctx, service],
  );

  const compareVariants = useCallback(
    (variantA: string, variantB: string) =>
      ctx.execute(() => service.compareVariants(variantA, variantB), 'Failed to compare variants'),
    [ctx, service],
  );

  const generateHashtags = useCallback(
    async (content: string, count: number): Promise<string[]> => {
      const result = await ctx.execute(() => service.generateHashtags(content, count), 'Failed to generate hashtags');
      return result ?? [];
    },
    [ctx, service],
  );

  const generateImagePrompt = useCallback(
    (description: string, style: string) =>
      ctx.execute(() => service.generateImagePrompt(description, style), 'Failed to generate image prompt'),
    [ctx, service],
  );

  const generateVoiceScript = useCallback(
    (topic: string, emotion: Emotion, duration: number) =>
      ctx.execute(() => service.generateVoiceScript(topic, emotion, duration), 'Failed to generate voice script', { reportProgress: true }),
    [ctx, service],
  );

  const generateImage = useCallback(
    (request: ImageGenerationRequest) =>
      ctx.execute(() => service.generateImage(request), 'Failed to generate image', { reportProgress: true }),
    [ctx, service],
  );

  const generateVideo = useCallback(
    (request: VideoGenerationRequest) =>
      ctx.execute(() => service.generateVideo(request), 'Failed to generate video', { reportProgress: true }),
    [ctx, service],
  );

  const convertImageToVideo = useCallback(
    (request: ImageToVideoRequest) =>
      ctx.execute(() => service.convertImageToVideo(request), 'Failed to convert image to video', { reportProgress: true }),
    [ctx, service],
  );

  const transformVideo = useCallback(
    (request: VideoToVideoRequest) =>
      ctx.execute(() => service.transformVideo(request), 'Failed to transform video', { reportProgress: true }),
    [ctx, service],
  );

  return {
    isLoading: ctx.isLoading,
    progress: ctx.progress,
    error: ctx.error,
    errorCode: ctx.errorCode,
    generateBlogPost,
    generateSocialContent,
    generateForAllPlatforms,
    generateVideoScript,
    generateContentCalendar,
    analyzeSentiment,
    analyzeContent,
    optimizeSEO,
    calculateSEOScore,
    predictABTest,
    compareVariants,
    generateHashtags,
    generateImagePrompt,
    generateVoiceScript,
    generateImage,
    generateVideo,
    convertImageToVideo,
    transformVideo,
  };
}
