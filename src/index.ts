/**
 * @umituz/web-ai — root entry, React-free and Workers-safe.
 *
 * Compose with createAI(), then chat/stream/generate media through the
 * provider-neutral factory. Swapping Groq ↔ Claude ↔ Gemini is a config
 * change, not a code change.
 *
 * React hooks live in `@umituz/web-ai/hooks`, content services in
 * `./content`, wizards in `./wizard`. The chat entry re-exports its
 * conversation message type as `ChatMessage`; here it is aliased to
 * `ConversationMessage` because core already owns the wire-level
 * `ChatMessage {role, content}`.
 */

export * from './core';
export * from './providers';

export type {
  ChatMessageSender,
  ChatMessageType,
  ChatConversation,
  SendMessageInput,
  SendMessageResult,
  ChatConfig,
  IChatStorage,
  ChatTokenUsage,
} from './chat';
export type {
  IChatService,
  UseChatOptions,
  UseChatReturn,
  IMessageFormatter,
  SystemPromptStrategy,
} from './chat';
export type { ChatMessage as ConversationMessage } from './chat';
export { ChatService, messageFormatter, extractTokenUsage } from './chat';
export { chatIdGenerator, ChatIdGenerator, DEFAULT_PROMPT_STRATEGY } from './chat';

// Content-generation domain services, types, calculations, and wizards (React-free)
export {
  AIContentService,
  BlogService,
  SocialService,
  VideoScriptService,
  AnalysisService,
  SeoService,
  ABTestService,
  ImagePromptService,
  ContentCalendarService,
  MediaGenerationService,
  GenerationExecutor,
  PromptBuilder,
  GENERATION_COSTS,
  calculateCreditCost,
  ASPECT_RATIO_VALUES,
  IMAGE_QUALITY_VALUES,
  VIDEO_QUALITY_VALUES,
  VIDEO_DURATION_OPTIONS,
  MOTION_OPTIONS,
  STYLE_PRESETS,
  getDimensionsForAspectRatio,
  getRecommendedQuality,
  ASPECT_RATIO_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  VIDEO_QUALITY_OPTIONS,
  VIDEO_DURATION_OPTIONS_SECONDS,
  CONTENT_WIZARD_STEPS,
  buildContentRequest,
  IMAGE_WIZARD_STEPS,
  buildImageRequest,
  VIDEO_WIZARD_STEPS,
  buildVideoRequest,
  ProviderUnavailableError,
  ProviderQuotaExhaustedError,
} from './content';

export type {
  SocialPlatform,
  ContentTone,
  ContentType,
  Emotion,
  Sentiment,
  BlogType,
  PlatformSpecs,
  PLATFORM_SPECS,
  GenerationType,
  ImageQuality,
  VideoQuality,
  AspectRatio,
  GenerationStatus,
  ImageGenerationInput,
  VideoGenerationInput,
  ContentGenerationResult,
  GenerationMetadata,
  GenerationProgress,
  CreditCost,
  BlogGenerationRequest,
  GeneratedBlog,
  SocialContentRequest,
  GeneratedSocialContent,
  VideoScriptRequest,
  GeneratedVideoScript,
  ContentCalendarEntry,
  ContentAnalysisRequest,
  ContentAnalysisResult,
  SentimentAnalysisResult,
  SEOOptimizationRequest,
  SEOOptimizationResult,
  SEOScoreBreakdown,
  KeywordAnalysis,
  ABTestRequest,
  ABTestPrediction,
  ABTestComparison,
  ABTestVariant,
  IAIContentService,
  ITextGenerator,
  TextGenerationOptions,
  AIErrorCode,
  WizardStep,
  WizardConfig,
  WizardData,
  ValidationResult,
  ContentWizardStep,
  ContentWizardData,
  ContentWizardType,
  ImageWizardStep,
  ImageWizardData,
  VideoWizardStep,
  VideoWizardData,
  VideoGenerationType,
} from './content';
