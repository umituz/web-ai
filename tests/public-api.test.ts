import { describe, expect, it } from "vitest";
import * as root from "../src/index";
import * as core from "../src/core";
import * as providers from "../src/providers";
import * as chat from "../src/chat";
import * as content from "../src/content";
import * as wizard from "../src/wizard";
import * as hooks from "../src/hooks";
import type { ConversationMessage } from "../src/index";
import type { ChatMessage } from "../src/chat";
import type { ContentGenerationResult } from "../src/content";

/**
 * Type-only exports are invisible to a runtime namespace object, so their
 * presence is pinned here instead: if a barrel stops exporting one, tsc
 * fails on this annotation before a publish ships the break.
 */
const typeOnlyExports: {
  conversationMessage: ConversationMessage | null;
  chatDomainMessage: ChatMessage | null;
  contentResult: ContentGenerationResult | null;
} = { conversationMessage: null, chatDomainMessage: null, contentResult: null };

/**
 * Contract test over the 7-entry exports map. Written from the barrels'
 * actual output: if a public symbol is renamed or dropped, this file fails
 * before a publish ships a breaking change unannounced.
 */

const expectExports = (module: object, names: string[]): void => {
  for (const name of names) {
    expect(module, `expected export "${name}"`).toHaveProperty(name);
  }
};

describe("public API — @umituz/web-ai", () => {
  it("root stays React-free and Workers-safe (no react import anywhere in the graph)", async () => {
    const rootSource = JSON.stringify(Object.keys(root));
    expect(rootSource).not.toContain("useChat");
    expect(rootSource).toContain("createAI");
    // The only entry allowed to touch React is ./hooks.
    expect(() => import("../src/hooks")).not.toThrow();
  });

  it("root: composition root + unified result types", () => {
    expectExports(root, [
      "createAI",
      "ProviderFactory",
      "AIError",
      "AIErrorType",
      "GroqProvider",
      "AnthropicProvider",
      "GeminiProvider",
      "FalProvider",
      "resolveModel",
      "isTextTier",
    ]);
    // Chat's conversation-level ChatMessage is aliased as ConversationMessage;
    // type-only, so its presence is pinned by the typeOnlyExports annotation.
    expect(typeOnlyExports.conversationMessage).toBeNull();
  });

  it("core: engine strategies, cache, SSE bridge, tiers", () => {
    expectExports(core, [
      "CompositeExecutor",
      "RetryExecutor",
      "QueueExecutor",
      "DedupeExecutor",
      "CacheManager",
      "RetryManager",
      "RequestQueue",
      "RequestDeduplicator",
      "createSseResponse",
      "StreamingResponseParser",
      "resolveModel",
      "mergeTierOverrides",
      "isTextTier",
      "AIError",
      "AIErrorType",
    ]);
  });

  it("providers: factory + every provider class", () => {
    expectExports(providers, [
      "createAI",
      "ProviderFactory",
      "GroqProvider",
      "AnthropicProvider",
      "GeminiProvider",
      "FalProvider",
      "PrunaProvider",
      "isTextProvider",
      "isMediaProvider",
    ]);
  });

  it("chat: ChatService over provider or factory engines", () => {
    expectExports(chat, ["ChatService", "messageFormatter", "extractTokenUsage"]);
    expect(typeOnlyExports.chatDomainMessage).toBeNull();
  });

  it("content: domain + 9 services + PromptBuilder + GenerationExecutor", () => {
    expectExports(content, ["AIContentService", "GenerationExecutor", "PromptBuilder"]);
    expect(typeOnlyExports.contentResult).toBeNull();
  });

  it("wizard: content flows", () => {
    expect(wizard).toBeDefined();
    expect(Object.keys(wizard).length).toBeGreaterThan(0);
  });

  it("hooks: the only React entry", () => {
    expectExports(hooks, [
      "useChat",
      "useText",
      "useGroq",
      "useCacheStats",
      "useAIContent",
      "useAIGeneration",
      "useBlogGenerator",
      "useSocialContentGenerator",
      "useContentWizard",
      "usePrunaGeneration",
      "usePrunaProxy",
    ]);
  });

  it("exports map: code entries + package.json, hooks isolated from the root", async () => {
    const packageJson = (await import("../package.json", { with: { type: "json" } })).default;
    const entries = Object.keys(packageJson.exports);
    expect(entries.sort()).toEqual(
      [
        ".",
        "./core",
        "./providers",
        "./groq",
        "./pruna",
        "./chat",
        "./content",
        "./wizard",
        "./hooks",
        "./package.json",
      ].sort(),
    );
  });
});
