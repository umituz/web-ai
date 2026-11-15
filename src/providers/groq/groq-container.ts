import type { GroqProviderConfig } from "./groq.entities";
import { GroqConfigStore } from "./groq-config-store";
import { GroqHttpClient } from "./groq-http-client";
import { GroqHttpTransport } from "./groq-http-transport";
import { TextGenerationService } from "./text-generation.service";
import { ChatService } from "../../chat/services/chat.service";
import { CacheManager } from "../../core/utils/cache-manager";
import { isValidApiKey } from "../../core/utils/api-key-validator";
import { GROQ_MODELS } from "./groq.constants";

export interface AppContainer {
  readonly groqHttpClient: GroqHttpClient;
  readonly textGeneration: TextGenerationService;
  readonly chat: ChatService;
}

let container: AppContainer | null = null;

export function configureProvider(config: GroqProviderConfig): AppContainer {
  const configStore = new GroqConfigStore();
  const transport = new GroqHttpTransport(configStore);
  const httpClient = new GroqHttpClient({ configStore, transport });
  httpClient.initialize(config);

  const textGeneration = new TextGenerationService(
    httpClient,
    new CacheManager(),
    config.textModel,
  );
  const chat = new ChatService(textGeneration);

  container = { groqHttpClient: httpClient, textGeneration, chat };
  return container;
}

export function getProvider(): AppContainer | null {
  return container;
}

export function resetProvider(): void {
  container?.groqHttpClient.reset();
  container = null;
}

export interface BootProviderOptions {
  readonly timeoutMs?: number;
  readonly textModel?: string;
}

export function bootProvider(apiKey: string | undefined, options: BootProviderOptions = {}): AppContainer | null {
  if (!isValidApiKey(apiKey)) return null;
  return getProvider() ?? configureProvider({
    apiKey: apiKey.trim(),
    timeoutMs: options.timeoutMs ?? 30_000,
    textModel: options.textModel ?? GROQ_MODELS.GPT_OSS_120B,
  });
}
