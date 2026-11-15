import { describe, expect, it } from "vitest";
import {
  ADAPTER_MEDIA_TIMEOUT_MS,
  ADAPTER_TIMEOUT_MS,
  apiKeyAvailable,
  audioTranscriptionAdapterFor,
  chatAdapterFor,
  createAdapterResolver,
  embeddingsAdapterFor,
  imageAdapterFor,
  resolveApiKey,
  speechAdapterFor,
} from "../../src/providers/adapters/adapter-resolver";
import { AiError } from "../../src/core/errors";

const ENV = { GROQ_API_KEY: "  gsk_test  ", EMPTY_KEY: "   " };

const OPENAI = { adapter: "openai-compatible", baseUrl: "https://api.groq.com/openai/v1/", apiKey: "k" };
const ANTHROPIC = { adapter: "anthropic", baseUrl: "https://api.anthropic.com", apiKey: "k" };

describe("resolveApiKey / apiKeyAvailable", () => {
  it("reads and trims env values", () => {
    expect(resolveApiKey(ENV, "GROQ_API_KEY")).toBe("gsk_test");
  });

  it("throws AiError('missing_key') for unset or blank values", () => {
    expect(() => resolveApiKey(ENV, "NOPE")).toThrowError(AiError);
    expect(() => resolveApiKey(ENV, "NOPE")).toThrowError(/API key/);
    expect(() => resolveApiKey(ENV, "EMPTY_KEY")).toThrowError(AiError);
  });

  it("apiKeyAvailable is the non-throwing probe", () => {
    expect(apiKeyAvailable(ENV, "GROQ_API_KEY")).toBe(true);
    expect(apiKeyAvailable(ENV, "NOPE")).toBe(false);
  });
});

describe("standalone adapter factories", () => {
  it("chatAdapterFor supports both kinds and rejects unknown kinds", () => {
    expect(chatAdapterFor(OPENAI)).toBeDefined();
    expect(chatAdapterFor(ANTHROPIC)).toBeDefined();
    expect(() => chatAdapterFor({ ...OPENAI, adapter: "gemini" })).toThrowError(AiError);
    expect(() => chatAdapterFor({ ...OPENAI, adapter: "gemini" })).toThrowError(
      /Unsupported adapter kind/,
    );
  });

  it("media adapters are openai-compatible only", () => {
    expect(imageAdapterFor(OPENAI)).toBeDefined();
    expect(embeddingsAdapterFor(OPENAI)).toBeDefined();
    expect(audioTranscriptionAdapterFor(OPENAI)).toBeDefined();
    expect(speechAdapterFor(OPENAI)).toBeDefined();

    expect(() => imageAdapterFor(ANTHROPIC)).toThrowError(/does not support images/);
    expect(() => embeddingsAdapterFor(ANTHROPIC)).toThrowError(/does not support embeddings/);
    expect(() => audioTranscriptionAdapterFor(ANTHROPIC)).toThrowError(
      /does not support audio transcription/,
    );
    expect(() => speechAdapterFor(ANTHROPIC)).toThrowError(/does not support speech synthesis/);
  });
});

describe("createAdapterResolver", () => {
  const resolver = createAdapterResolver(ENV);

  it("resolves adapters from env bindings", () => {
    const binding = {
      adapter: "openai-compatible",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKeyEnv: "GROQ_API_KEY",
    };
    expect(resolver.chat(binding)).toBeDefined();
    expect(resolver.embeddings(binding)).toBeDefined();
    expect(resolver.available(binding)).toBe(true);
  });

  it("propagates missing_key for unconfigured providers", () => {
    const binding = {
      adapter: "anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKeyEnv: "ANTHROPIC_API_KEY",
    };
    expect(() => resolver.chat(binding)).toThrowError(AiError);
    expect(resolver.available(binding)).toBe(false);
  });

  it("honors custom timing", () => {
    const fast = createAdapterResolver(ENV, { timeoutMs: 5, mediaTimeoutMs: 6 });
    expect(ADAPTER_TIMEOUT_MS).toBe(60_000);
    expect(ADAPTER_MEDIA_TIMEOUT_MS).toBe(120_000);
    expect(fast).toBeDefined();
  });
});
