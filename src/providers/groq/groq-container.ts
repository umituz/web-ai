import type { GroqProviderConfig } from "./groq.entities";
import { GroqConfigStore } from "./groq-config-store";
import { GroqHttpClient } from "./groq-http-client";
import { GroqHttpTransport } from "./groq-http-transport";
import { TextGenerationService } from "./text-generation.service";
import { ChatService } from "../../chat/services/chat.service";
import { CacheManager } from "../../core/utils/cache-manager";

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
