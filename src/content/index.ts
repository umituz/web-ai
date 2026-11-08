/**
 * Content-generation layer ported from web-ai-content: the pure domain, the
 * nine application services, PromptBuilder, GenerationExecutor seam, and wizards.
 * Wizards also live in the `./wizard` entry, React hooks in `./hooks`.
 */

export * from './domain';
export type { IAIContentService } from './domain/interfaces/IAIContentService';
export type { GenerationResult as ContentGenerationResult } from './domain/types/GenerationTypes';

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

export * from './application/prompts';

// Wizard orchestration re-exports
export type { WizardStep, WizardConfig, WizardData, ValidationResult } from '../wizard/base.wizard';
export type {
  ContentWizardStep,
  ContentWizardData,
  ContentType as ContentWizardType,
} from '../wizard/content.wizard';
export {
  CONTENT_WIZARD_STEPS,
  buildContentRequest,
} from '../wizard/content.wizard';
export type {
  ImageWizardStep,
  ImageWizardData,
} from '../wizard/image.wizard';
export {
  IMAGE_WIZARD_STEPS,
  buildImageRequest,
} from '../wizard/image.wizard';
export type {
  VideoWizardStep,
  VideoWizardData,
  VideoGenerationType,
} from '../wizard/video.wizard';
export {
  VIDEO_WIZARD_STEPS,
  buildVideoRequest,
} from '../wizard/video.wizard';

// Infrastructure utilities
export {
  safeJSONParse,
  extractJSON,
  parseAIResponse,
  isValidJSON,
} from './infrastructure/utils/jsonParser';
export {
  RequestPriority,
  batchRequest,
  RequestQueue as ContentRequestQueue,
} from './infrastructure/utils/requestQueue';
export type { QueueConfig } from './infrastructure/utils/requestQueue';
