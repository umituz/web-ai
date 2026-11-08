
import type { IAIContentService } from '../../domain/interfaces/IAIContentService';
import type { ITextGenerator } from '../../domain/interfaces/ITextGenerator';
import type {
  BlogGenerationRequest,
  GeneratedBlog,
  SocialContentRequest,
  GeneratedSocialContent,
  VideoScriptRequest,
  GeneratedVideoScript,
  ContentCalendarEntry,
} from '../../domain/entities/ContentGeneration';
import type {
  ContentAnalysisRequest,
  ContentAnalysisResult,
  SentimentAnalysisResult,
} from '../../domain/entities/SentimentAnalysis';
import type {
  SEOOptimizationRequest,
  SEOOptimizationResult,
  SEOScoreBreakdown,
  KeywordAnalysis,
} from '../../domain/entities/SEO';
import type {
  ABTestRequest,
  ABTestPrediction,
  ABTestComparison,
} from '../../domain/entities/ABTesting';
import type { SocialPlatform, ContentTone, Emotion } from '../../domain/types';
import type {
  ProviderConfig,
  ImageGenerationRequest,
  VideoGenerationRequest,
  ImageToVideoRequest,
  VideoToVideoRequest,
  GeneratedContent,
} from '../../domain/config/ProviderConfig';
import { createAI, type AIProviderConfig } from '../../../providers/factory/create-ai';
import { ProviderFactory } from '../../../providers/factory/provider.factory';
import { BlogService } from './BlogService';
import { SocialService } from './SocialService';
import { VideoScriptService } from './VideoScriptService';
import { AnalysisService } from './AnalysisService';
import { SeoService } from './SeoService';
import { ABTestService } from './ABTestService';
import { ImagePromptService } from './ImagePromptService';
import { ContentCalendarService } from './ContentCalendarService';
import { MediaGenerationService } from './ProviderServices';
import { GenerationExecutor } from './GenerationExecutor';

interface ServiceBundle {
  providerFactory: ProviderFactory;
  blogService: BlogService;
  socialService: SocialService;
  videoScriptService: VideoScriptService;
  analysisService: AnalysisService;
  seoService: SeoService;
  abTestService: ABTestService;
  imagePromptService: ImagePromptService;
  contentCalendarService: ContentCalendarService;
  mediaGenerationService: MediaGenerationService;
}

const isTextGenerator = (value: unknown): value is ITextGenerator =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ITextGenerator).generateText === "function";

/**
 * Accepts the new AIProviderConfig (provider blocks, presence = enabled) or a
 * legacy web-ai-content ProviderConfig (blocks gated by `enabled`) and maps
 * the latter onto the former — one constructor, both worlds.
 */
function toAIProviderConfig(config: AIProviderConfig | ProviderConfig): AIProviderConfig {
  const legacy = config as ProviderConfig;
  const modern = config as AIProviderConfig;

  const anthropic =
    modern.anthropic ??
    (legacy.anthropic?.enabled
      ? {
          apiKey: legacy.anthropic.apiKey,
          baseUrl: legacy.anthropic.baseUrl,
          timeoutMs: legacy.anthropic.timeout,
          models: legacy.anthropic.models,
          effort: legacy.anthropic.effort,
        }
      : undefined);
  const groq =
    modern.groq ??
    (legacy.groq?.enabled
      ? {
          apiKey: legacy.groq.apiKey,
          baseUrl: legacy.groq.baseUrl,
          timeoutMs: legacy.groq.timeout,
          // legacy {text, chat} model pins map onto the neutral tier slots
          ...(legacy.groq.models?.text
            ? { models: { balanced: legacy.groq.models.text } }
            : {}),
        }
      : undefined);
  const gemini =
    modern.gemini ?? (legacy.gemini?.enabled ? { ...legacy.gemini } : undefined);
  const fal = modern.fal ?? (legacy.fal?.enabled ? { ...legacy.fal } : undefined);
  const pruna = modern.pruna ?? (legacy.pruna?.enabled ? { ...legacy.pruna } : undefined);

  return {
    priority: modern.priority,
    fallbackEnabled: modern.fallbackEnabled,
    defaultTier: modern.defaultTier,
    ...(anthropic ? { anthropic } : {}),
    ...(groq ? { groq } : {}),
    ...(gemini ? { gemini } : {}),
    ...(fal ? { fal } : {}),
    ...(pruna ? { pruna } : {}),
  };
}

const buildServices = (
  configOrGenerator: AIProviderConfig | ProviderConfig | ITextGenerator,
): ServiceBundle => {
  if (isTextGenerator(configOrGenerator)) {
    const executor = new GenerationExecutor(configOrGenerator);
    const emptyFactory = new ProviderFactory({
      priority: [],
      fallbackEnabled: false,
    });
    return {
      providerFactory: emptyFactory,
      blogService: new BlogService(executor),
      socialService: new SocialService(executor),
      videoScriptService: new VideoScriptService(executor),
      analysisService: new AnalysisService(executor),
      seoService: new SeoService(executor),
      abTestService: new ABTestService(executor),
      imagePromptService: new ImagePromptService(executor),
      contentCalendarService: new ContentCalendarService(executor),
      mediaGenerationService: new MediaGenerationService(emptyFactory),
    };
  }

  const factory = createAI(toAIProviderConfig(configOrGenerator));
  const executor = new GenerationExecutor(factory);
  return {
    providerFactory: factory,
    blogService: new BlogService(executor),
    socialService: new SocialService(executor),
    videoScriptService: new VideoScriptService(executor),
    analysisService: new AnalysisService(executor),
    seoService: new SeoService(executor),
    abTestService: new ABTestService(executor),
    imagePromptService: new ImagePromptService(executor),
    contentCalendarService: new ContentCalendarService(executor),
    mediaGenerationService: new MediaGenerationService(factory),
  };
};

export class AIContentService implements IAIContentService {
  private readonly providerFactory: ProviderFactory;
  private readonly blogService: BlogService;
  private readonly socialService: SocialService;
  private readonly videoScriptService: VideoScriptService;
  private readonly analysisService: AnalysisService;
  private readonly seoService: SeoService;
  private readonly abTestService: ABTestService;
  private readonly imagePromptService: ImagePromptService;
  private readonly contentCalendarService: ContentCalendarService;
  private readonly mediaGenerationService: MediaGenerationService;

  constructor(
    configOrGenerator: AIProviderConfig | ProviderConfig | ITextGenerator,
  ) {
    const bundle = buildServices(configOrGenerator);
    this.providerFactory = bundle.providerFactory;
    this.blogService = bundle.blogService;
    this.socialService = bundle.socialService;
    this.videoScriptService = bundle.videoScriptService;
    this.analysisService = bundle.analysisService;
    this.seoService = bundle.seoService;
    this.abTestService = bundle.abTestService;
    this.imagePromptService = bundle.imagePromptService;
    this.contentCalendarService = bundle.contentCalendarService;
    this.mediaGenerationService = bundle.mediaGenerationService;
  }

  /** The composed factory — chat()/chatStream() with usage, health, fallback. */
  get providers(): ProviderFactory {
    return this.providerFactory;
  }

  generateBlogPost(request: BlogGenerationRequest): Promise<GeneratedBlog> {
    return this.blogService.generateBlogPost(request);
  }

  generateSocialContent(request: SocialContentRequest): Promise<GeneratedSocialContent> {
    return this.socialService.generateSocialContent(request);
  }
  generateForAllPlatforms(topic: string, tone: ContentTone): Promise<GeneratedSocialContent[]> {
    return this.socialService.generateForAllPlatforms(topic, tone);
  }
  generateHashtags(content: string, count: number): Promise<string[]> {
    return this.socialService.generateHashtags(content, count);
  }
  optimizeHashtags(hashtags: string[], platform: SocialPlatform): Promise<string[]> {
    return Promise.resolve(this.socialService.optimizeHashtags(hashtags, platform));
  }

  generateVideoScript(request: VideoScriptRequest): Promise<GeneratedVideoScript> {
    return this.videoScriptService.generateVideoScript(request);
  }
  generateVoiceScript(topic: string, emotion: Emotion, duration: number): Promise<GeneratedVideoScript> {
    return this.videoScriptService.generateVoiceScript(topic, emotion, duration);
  }

  generateContentCalendar(niche: string, days: number): Promise<ContentCalendarEntry[]> {
    return this.contentCalendarService.generateContentCalendar(niche, days);
  }

  analyzeSentiment(content: string): Promise<SentimentAnalysisResult> {
    return this.analysisService.analyzeSentiment(content);
  }
  analyzeContent(request: ContentAnalysisRequest): Promise<ContentAnalysisResult> {
    return this.analysisService.analyzeContent(request);
  }

  optimizeSEO(request: SEOOptimizationRequest): Promise<SEOOptimizationResult> {
    return this.seoService.optimizeSEO(request);
  }
  calculateSEOScore(content: string, keywords: string[]): Promise<SEOScoreBreakdown> {
    return this.seoService.calculateSEOScore(content, keywords);
  }
  analyzeKeywords(content: string, keywords: string[]): Promise<KeywordAnalysis[]> {
    return Promise.resolve(this.seoService.analyzeKeywords(content, keywords));
  }

  predictABTest(request: ABTestRequest): Promise<ABTestPrediction[]> {
    return this.abTestService.predictABTest(request);
  }
  compareVariants(variantA: string, variantB: string): Promise<ABTestComparison> {
    return this.abTestService.compareVariants(variantA, variantB);
  }

  generateImagePrompt(description: string, style: string): Promise<string> {
    return this.imagePromptService.generateImagePrompt(description, style);
  }
  generateImagePromptsForBlog(blogContent: string): Promise<string[]> {
    return this.imagePromptService.generateImagePromptsForBlog(blogContent);
  }

  generateImage(request: ImageGenerationRequest): Promise<GeneratedContent> {
    return this.mediaGenerationService.generateImage(request);
  }
  generateVideo(request: VideoGenerationRequest): Promise<GeneratedContent> {
    return this.mediaGenerationService.generateVideo(request);
  }
  convertImageToVideo(request: ImageToVideoRequest): Promise<GeneratedContent> {
    return this.mediaGenerationService.convertImageToVideo(request);
  }
  transformVideo(request: VideoToVideoRequest): Promise<GeneratedContent> {
    return this.mediaGenerationService.transformVideo(request);
  }
}
