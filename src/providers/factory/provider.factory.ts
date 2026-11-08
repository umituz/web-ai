
import type {
  GenerationResult,
  ProviderHealth,
  StreamCallbacks,
  StructuredGeneration,
  StructuredTextRequest,
  TextRequest,
  TextTier,
} from "../../core/types";
import { AIError, AIErrorType } from "../../core/errors";
import type {
  AnyProvider,
  IMediaProvider,
  ITextProvider,
  ProviderCapability,
} from "../base/provider.types";
import { isTextProvider } from "../base/provider.types";
import type {
  GeneratedContent,
  ImageGenerationRequest,
  ImageToVideoRequest,
  VideoGenerationRequest,
  VideoToVideoRequest,
} from "../../content/domain/config/ProviderConfig";
import type {
  ITextGenerator,
  TextGenerationOptions,
} from "../../content/domain/interfaces/ITextGenerator";
import { ProviderTimingConfig } from "../../content/domain/limits/ProviderTimingConfig";

export interface ProviderFactoryConfig {
  /** Provider ids in preference order; unlisted providers follow in registration order. */
  priority?: ReadonlyArray<string>;
  fallbackEnabled?: boolean;
  /** Tier used when a request names neither a model nor a tier. */
  defaultTier?: TextTier;
}

interface HealthCheckCache {
  health: ProviderHealth;
  timestamp: number;
}

/**
 * Composition-aware registry and router. Replaces both ancestors at once:
 * B's ProviderFactory (health TTL cache, priority fallback walk, media
 * dispatch) and A's singleton configureProvider (via createAI). Adds the
 * provider-neutral `chat`/`chatStream` text surface with full usage
 * propagation, and keeps B's ITextGenerator string facade so the ported
 * content services compile unchanged.
 */
export class ProviderFactory implements ITextGenerator {
  private readonly providers = new Map<string, AnyProvider>();
  private readonly healthCache = new Map<string, HealthCheckCache>();
  private readonly priority: ReadonlyArray<string>;
  private readonly fallbackEnabled: boolean;
  readonly defaultTier: TextTier;

  constructor(config: ProviderFactoryConfig = {}) {
    this.priority = config.priority ?? [];
    this.fallbackEnabled = config.fallbackEnabled ?? true;
    this.defaultTier = config.defaultTier ?? "balanced";
  }

  register(provider: AnyProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): AnyProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): AnyProvider[] {
    return Array.from(this.providers.values());
  }

  getByCapability(capability: ProviderCapability): AnyProvider[] {
    return this.getAllProviders().filter((provider) =>
      provider.capabilities.includes(capability),
    );
  }

  getTextProviders(): ITextProvider[] {
    return this.getAllProviders().filter(isTextProvider);
  }

  hasTextProvider(): boolean {
    return this.getByCapability("text").length > 0;
  }

  /* ---------- neutral text surface ---------- */

  /**
   * Single-chat entry point: resolves a healthy text provider by priority,
   * injects the default tier when the request names neither model nor tier,
   * and walks the fallback chain on failure. Providers map tiers onto their
   * own models, so switching Groq→Anthropic is a config change.
   */
  async chat(request: TextRequest): Promise<GenerationResult> {
    const effective: TextRequest =
      request.model || request.tier ? request : { ...request, tier: this.defaultTier };
    return this.executeWithFallback("text", (provider) =>
      (provider as ITextProvider).generate(effective),
    );
  }

  async chatStream(
    request: TextRequest,
    callbacks: StreamCallbacks,
  ): Promise<GenerationResult> {
    const effective: TextRequest =
      request.model || request.tier ? request : { ...request, tier: this.defaultTier };

    let lastError: unknown;
    // onError is withheld until every provider has failed — a successful
    // fallback would otherwise have already reported a spurious error.
    const attemptCallbacks: StreamCallbacks = {
      onChunk: callbacks.onChunk,
      onComplete: callbacks.onComplete,
    };

    const providers = this.getByCapability("text");
    if (providers.length === 0) {
      throw this.noProviderError("text");
    }

    const ordered = this.orderByPriority(providers);
    for (const provider of ordered) {
      if (!this.isProviderHealthy(provider.id)) continue;
      try {
        return await (provider as ITextProvider).stream(effective, attemptCallbacks);
      } catch (error) {
        lastError = error;
        this.markDegraded(provider.id);
        if (!this.fallbackEnabled) {
          callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      }
    }

    const failure = new AIError(
      AIErrorType.SERVER_ERROR,
      `All providers failed for capability 'text'`,
      lastError instanceof Error ? lastError : undefined,
    );
    callbacks.onError?.(lastError instanceof Error ? lastError : failure);
    throw failure;
  }

  /** AsyncGenerator adapter over chatStream — A's familiar consumption shape. */
  async *streamText(request: TextRequest): AsyncGenerator<string> {
    const queue: string[] = [];
    let wake: (() => void) | null = null;
    let finished = false;
    let failure: unknown;

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal?.addEventListener("abort", onAbort);
    const effectiveRequest = { ...request, signal: controller.signal };

    const notify = (): void => {
      const resolve = wake;
      wake = null;
      resolve?.();
    };

    const completion = this.chatStream(effectiveRequest, {
      onChunk: (chunk) => {
        queue.push(chunk);
        notify();
      },
    }).then(
      () => {
        finished = true;
        notify();
      },
      (error) => {
        failure = error;
        finished = true;
        notify();
      },
    );

    try {
      while (!finished || queue.length > 0) {
        if (queue.length === 0 && !finished) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }
        while (queue.length > 0) {
          yield queue.shift() as string;
        }
        if (failure) throw failure;
      }
      await completion;
    } finally {
      controller.abort();
      request.signal?.removeEventListener("abort", onAbort);
    }
  }

  async generateJson<T>(
    request: StructuredTextRequest,
  ): Promise<StructuredGeneration<T>> {
    const effective: StructuredTextRequest =
      request.model || request.tier ? request : { ...request, tier: this.defaultTier };
    return this.executeWithFallback("text", (provider) =>
      (provider as ITextProvider).generateStructured<T>(effective),
    );
  }

  /* ---------- content-layer string facade (ITextGenerator) ---------- */

  async generateText(prompt: string, options: TextGenerationOptions = {}): Promise<string> {
    const result = await this.chat({
      messages: [{ role: "user", content: prompt }],
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
    });
    return result.text;
  }

  generateTextStream(prompt: string, options: TextGenerationOptions = {}): AsyncGenerator<string> {
    return this.streamText({
      messages: [{ role: "user", content: prompt }],
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
    });
  }

  /* ---------- media surface ---------- */

  async generateImage(request: ImageGenerationRequest): Promise<GeneratedContent> {
    return this.executeWithFallback("image", (provider) =>
      (provider as IMediaProvider).generateImage(request),
    );
  }

  async generateVideo(request: VideoGenerationRequest): Promise<GeneratedContent> {
    return this.executeWithFallback("video", (provider) =>
      (provider as IMediaProvider).generateVideo(request),
    );
  }

  async imageToVideo(request: ImageToVideoRequest): Promise<GeneratedContent> {
    return this.executeWithFallback("video", (provider) =>
      (provider as IMediaProvider).imageToVideo(request),
    );
  }

  async videoToVideo(request: VideoToVideoRequest): Promise<GeneratedContent> {
    return this.executeWithFallback("video", (provider) =>
      (provider as IMediaProvider).videoToVideo(request),
    );
  }

  /* ---------- health ---------- */

  async checkProviderHealth(providerId: string, forceRefresh = false): Promise<ProviderHealth> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return "unavailable";
    }

    const cached = this.healthCache.get(providerId);
    const now = Date.now();
    const ttl = ProviderTimingConfig.HEALTH_CHECK_TTL_MS;

    if (!forceRefresh && cached && now - cached.timestamp < ttl) {
      return cached.health;
    }

    try {
      const health = await provider.healthCheck();
      this.healthCache.set(providerId, { health, timestamp: now });
      return health;
    } catch {
      this.healthCache.set(providerId, { health: "unavailable", timestamp: now });
      return "unavailable";
    }
  }

  isProviderHealthy(providerId: string): boolean {
    const cached = this.healthCache.get(providerId);
    if (!cached) {
      return true;
    }
    return cached.health === "healthy" || cached.health === "degraded";
  }

  async refreshAllHealth(): Promise<void> {
    await Promise.all(
      Array.from(this.providers.keys()).map((id) => this.checkProviderHealth(id)),
    );
  }

  /* ---------- internals ---------- */

  private async executeWithFallback<T>(
    capability: ProviderCapability,
    fn: (provider: AnyProvider) => Promise<T>,
  ): Promise<T> {
    const providers = this.getByCapability(capability);
    if (providers.length === 0) {
      throw this.noProviderError(capability);
    }

    let lastError: unknown;
    for (const provider of this.orderByPriority(providers)) {
      if (!this.isProviderHealthy(provider.id)) {
        continue;
      }

      try {
        return await fn(provider);
      } catch (error) {
        lastError = error;
        this.markDegraded(provider.id);
        if (!this.fallbackEnabled) {
          throw error;
        }
      }
    }

    throw new AIError(
      AIErrorType.SERVER_ERROR,
      `All providers failed for capability '${capability}'`,
      lastError instanceof Error ? lastError : undefined,
    );
  }

  private orderByPriority(providers: AnyProvider[]): AnyProvider[] {
    if (this.priority.length === 0) {
      return providers;
    }
    const ordered: AnyProvider[] = [];
    for (const providerId of this.priority) {
      const provider = providers.find((p) => p.id === providerId);
      if (provider) ordered.push(provider);
    }
    for (const provider of providers) {
      if (!this.priority.includes(provider.id)) {
        ordered.push(provider);
      }
    }
    return ordered;
  }

  private markDegraded(providerId: string): void {
    const cached = this.healthCache.get(providerId);
    if (cached) {
      this.healthCache.set(providerId, { health: "degraded", timestamp: cached.timestamp });
    }
  }

  private noProviderError(capability: ProviderCapability): AIError {
    return new AIError(
      AIErrorType.MISSING_CONFIG,
      `No provider registered for capability '${capability}' — create one with createAI() and include its config block`,
    );
  }
}

export function createProviderFactory(config?: ProviderFactoryConfig): ProviderFactory {
  return new ProviderFactory(config);
}
