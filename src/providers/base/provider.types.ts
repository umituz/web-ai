
import type {
  GenerationResult,
  ProviderHealth,
  StreamCallbacks,
  StructuredGeneration,
  StructuredTextRequest,
  TextRequest,
  TextTier,
} from "../../core/types";
import type {
  GeneratedContent,
  ImageGenerationRequest,
  ImageToVideoRequest,
  TextGenerationRequest,
  VideoGenerationRequest,
  VideoToVideoRequest,
} from "../../content/domain/config/ProviderConfig";

/**
 * What a provider can serve. Replaces the old single `'multimodal'` type flag:
 * a provider declares exactly the capabilities it implements, and the factory
 * walks providers by capability when routing or failing over.
 */
export type ProviderCapability = "text" | "image" | "video";

/** Cost estimation input — any generation request shape the fleet knows. */
export type CostEstimateRequest =
  | TextGenerationRequest
  | ImageGenerationRequest
  | VideoGenerationRequest;

export interface IProviderBase {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ReadonlyArray<ProviderCapability>;
  healthCheck(): Promise<ProviderHealth>;
  estimateCost(request: CostEstimateRequest): Promise<number>;
}

/**
 * A provider that can turn conversations into text. This is the surface the
 * factory's `chat`/`chatStream` walk; model choice per quality tier is the
 * provider's own business (each maps neutral tiers onto its catalogue).
 */
export interface ITextProvider extends IProviderBase {
  generate(request: TextRequest): Promise<GenerationResult>;
  generateStructured<T>(request: StructuredTextRequest): Promise<StructuredGeneration<T>>;
  stream(request: TextRequest, callbacks: StreamCallbacks): Promise<GenerationResult>;
  resolveModel(tier: TextTier): string;
}

/**
 * A provider that generates media. Kept as B's media surface — image/video
 * request and result shapes are already provider-neutral.
 */
export interface IMediaProvider extends IProviderBase {
  generateImage(request: ImageGenerationRequest): Promise<GeneratedContent>;
  generateVideo(request: VideoGenerationRequest): Promise<GeneratedContent>;
  imageToVideo(request: ImageToVideoRequest): Promise<GeneratedContent>;
  videoToVideo(request: VideoToVideoRequest): Promise<GeneratedContent>;
}

export type AnyProvider = ITextProvider | IMediaProvider;

export function isTextProvider(provider: AnyProvider): provider is ITextProvider {
  return provider.capabilities.includes("text");
}

export function isMediaProvider(provider: AnyProvider): provider is IMediaProvider {
  return provider.capabilities.includes("image") || provider.capabilities.includes("video");
}
