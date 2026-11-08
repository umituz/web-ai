
import type { TextTier } from "../../core/types";
import { ProviderFactory } from "./provider.factory";
import { AnthropicProvider } from "../anthropic/anthropic.provider";
import type { AnthropicProviderConfig } from "../anthropic/anthropic.entities";
import { GroqProvider } from "../groq/groq.provider";
import type { GroqProviderConfig } from "../groq/groq.entities";
import { GeminiProvider } from "../gemini/gemini.provider";
import { FalProvider } from "../fal/fal.provider";
import { PrunaProvider } from "../pruna/pruna.provider";
import type {
  FalConfig,
  GeminiConfig,
  PrunaConfig,
} from "../../content/domain/config/ProviderConfig";

/**
 * Composition root for the whole package — replaces the old
 * `configureProvider()` singleton. A provider block's presence means the
 * provider is enabled; presence of its apiKey is what actually registers it.
 * `priority` decides who serves first; the fallback walk handles the rest.
 *
 * ```ts
 * const ai = createAI({
 *   priority: ['anthropic', 'groq'],
 *   defaultTier: 'balanced',
 *   anthropic: { apiKey: env.ANTHROPIC_API_KEY },
 *   groq: { apiKey: env.GROQ_API_KEY },
 * });
 * const { text, usage } = await ai.chat({ messages, systemPrompt });
 * ```
 */
export interface AIProviderConfig {
  /** Provider ids in preference order for every capability. */
  priority?: ReadonlyArray<string>;
  fallbackEnabled?: boolean;
  /** Tier used when a request names neither model nor tier. Default 'balanced'. */
  defaultTier?: TextTier;

  anthropic?: AnthropicProviderConfig;
  groq?: GroqProviderConfig;
  gemini?: Omit<GeminiConfig, "enabled">;
  fal?: Omit<FalConfig, "enabled">;
  pruna?: Omit<PrunaConfig, "enabled">;
}

export function createAI(config: AIProviderConfig = {}): ProviderFactory {
  const factory = new ProviderFactory({
    priority: config.priority,
    fallbackEnabled: config.fallbackEnabled,
    defaultTier: config.defaultTier,
  });

  if (config.anthropic?.apiKey) {
    factory.register(new AnthropicProvider(config.anthropic));
  }
  if (config.groq?.apiKey) {
    factory.register(new GroqProvider(config.groq));
  }
  if (config.gemini?.apiKey) {
    factory.register(new GeminiProvider({ ...config.gemini, enabled: true } as GeminiConfig));
  }
  if (config.fal?.apiKey) {
    factory.register(new FalProvider({ ...config.fal, enabled: true } as FalConfig));
  }
  if (config.pruna?.apiKey) {
    factory.register(new PrunaProvider({ ...config.pruna, enabled: true } as PrunaConfig));
  }

  return factory;
}
