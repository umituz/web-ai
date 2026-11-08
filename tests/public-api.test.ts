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
 * Contract test over the exports map. Written from the barrels'
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
    expect(rootSource).not.toContain("useAIContent");
    expect(rootSource).not.toContain("useAIGeneration");
    expect(rootSource).toContain("createAI");
    // The only entry allowed to touch React is ./hooks.
    expect(() => import("../src/hooks")).not.toThrow();
  });

  it("root: composition root + unified result types + content layer", () => {
    expectExports(root, [
      "createAI",
      "ProviderFactory",
      "createProviderFactory",
      "AIError",
      "AIErrorType",
      "GroqProvider",
      "createGroqProvider",
      "AnthropicProvider",
      "GeminiProvider",
      "createGeminiProvider",
      "FalProvider",
      "createFalProvider",
      "PrunaProvider",
      "createPrunaProvider",
      "resolveModel",
      "isTextTier",
      "AIContentService",
      "BlogService",
      "SocialService",
      "VideoScriptService",
      "AnalysisService",
      "SeoService",
      "ABTestService",
      "ImagePromptService",
      "ContentCalendarService",
      "MediaGenerationService",
      "GenerationExecutor",
      "PromptBuilder",
      "calculateCreditCost",
      "GENERATION_COSTS",
      "CONTENT_WIZARD_STEPS",
      "buildContentRequest",
      "IMAGE_WIZARD_STEPS",
      "buildImageRequest",
      "VIDEO_WIZARD_STEPS",
      "buildVideoRequest",
      "safeJSONParse",
      "extractJSON",
      "RequestPriority",
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

  it("providers: factory + every provider class + creators", () => {
    expectExports(providers, [
      "createAI",
      "ProviderFactory",
      "createProviderFactory",
      "GroqProvider",
      "createGroqProvider",
      "AnthropicProvider",
      "GeminiProvider",
      "createGeminiProvider",
      "FalProvider",
      "createFalProvider",
      "PrunaProvider",
      "createPrunaProvider",
      "BaseProvider",
      "BaseAIProvider",
      "isTextProvider",
      "isMediaProvider",
    ]);
  });

  it("chat: ChatService over provider or factory engines", () => {
    expectExports(chat, ["ChatService", "messageFormatter", "extractTokenUsage"]);
    expect(typeOnlyExports.chatDomainMessage).toBeNull();
  });

  it("content: domain + 10 services + PromptBuilder + GenerationExecutor + wizards", () => {
    expectExports(content, [
      "AIContentService",
      "BlogService",
      "SocialService",
      "VideoScriptService",
      "AnalysisService",
      "SeoService",
      "ABTestService",
      "ImagePromptService",
      "ContentCalendarService",
      "MediaGenerationService",
      "GenerationExecutor",
      "PromptBuilder",
      "calculateCreditCost",
      "GENERATION_COSTS",
      "CONTENT_WIZARD_STEPS",
      "buildContentRequest",
      "IMAGE_WIZARD_STEPS",
      "buildImageRequest",
      "VIDEO_WIZARD_STEPS",
      "buildVideoRequest",
      "TextModelDefaults",
      "ModelDefaults",
      "safeJSONParse",
      "extractJSON",
      "RequestPriority",
    ]);
    expect(typeOnlyExports.contentResult).toBeNull();
  });

  it("wizard: content flows", () => {
    expect(wizard).toBeDefined();
    expect(Object.keys(wizard).length).toBeGreaterThan(0);
    expectExports(wizard, [
      "CONTENT_WIZARD_STEPS",
      "buildContentRequest",
      "IMAGE_WIZARD_STEPS",
      "buildImageRequest",
      "VIDEO_WIZARD_STEPS",
      "buildVideoRequest",
    ]);
  });

  it("hooks: the only React entry, with content & pruna helpers", () => {
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
      "useImageWizard",
      "useVideoWizard",
      "usePrunaGeneration",
      "usePrunaProxy",
      "calculateCreditCost",
      "GENERATION_COSTS",
    ]);
  });

  it("exports map: code entries + aliases + package.json, hooks isolated from the root", async () => {
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
        "./domain",
        "./application",
        "./presentation",
        "./hooks",
        "./package.json",
      ].sort(),
    );
  });

  it("error taxonomy exports are stable", async () => {
    const errors = await import("../src/content/domain/errors/AIErrors");
    expect(Object.keys(errors).sort()).toEqual([
      "AIError",
      "ProviderQuotaExhaustedError",
      "ProviderUnavailableError",
      "ValidationError",
    ]);
  });

  it("AIContentService can be instantiated with string apiKey or provider config", () => {
    const s1 = new content.AIContentService("test-api-key");
    expect(s1).toBeDefined();
    const s2 = new root.AIContentService("test-api-key", "claude-3-5-sonnet");
    expect(s2).toBeDefined();
  });
});
