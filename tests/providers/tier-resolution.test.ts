import { describe, expect, it } from "vitest";
import { createAI } from "../../src/providers/factory/create-ai";
import { ProviderFactory } from "../../src/providers/factory/provider.factory";
import { AnthropicProvider } from "../../src/providers/anthropic/anthropic.provider";
import { GroqProvider } from "../../src/providers/groq/groq.provider";
import { resolveModel, mergeTierOverrides, isTextTier } from "../../src/core/tiers";

describe("tier resolution", () => {
  it("resolves default tier maps and falls back to balanced", () => {
    const tiers = { balanced: "m-balanced" } as const;
    expect(resolveModel(tiers, "fast", "test")).toBe("m-balanced");
    expect(resolveModel(tiers, "balanced", "test")).toBe("m-balanced");
  });

  it("throws a clear error when no model exists for the map", () => {
    expect(() => resolveModel({}, "fast", "prov")).toThrow(/prov has no model configured/);
  });

  it("merges per-instance overrides over provider defaults", () => {
    const merged = mergeTierOverrides(
      { fast: "a", balanced: "b", powerful: "c" },
      { powerful: "c2" },
    );
    expect(merged).toEqual({ fast: "a", balanced: "b", powerful: "c2" });
  });

  it("validates tier strings", () => {
    expect(isTextTier("fast")).toBe(true);
    expect(isTextTier("turbo")).toBe(false);
  });
});

describe("factory tier routing", () => {
  it("createAI registers only providers whose apiKey is present", () => {
    const factory = createAI({
      anthropic: { apiKey: "sk-ant" },
      groq: { apiKey: "" },
    });
    expect(factory.getAllProviders().map((p) => p.id)).toEqual(["anthropic"]);
    expect(factory.hasTextProvider()).toBe(true);
  });

  it("injects the factory defaultTier when a request names neither model nor tier", async () => {
    const provider = createFakeProvider("fake", {
      fast: "f-model",
      balanced: "b-model",
      powerful: "p-model",
    });
    const factory = new ProviderFactory({ defaultTier: "powerful" });
    factory.register(provider);

    await factory.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(provider.lastRequest?.model).toBeUndefined();
    expect(provider.lastRequest?.tier).toBe("powerful");
  });

  it("explicit model beats tier; request tier beats factory default", async () => {
    const provider = createFakeProvider("fake", {
      fast: "f-model",
      balanced: "b-model",
    });
    const factory = new ProviderFactory({ defaultTier: "fast" });
    factory.register(provider);

    await factory.chat({ messages: [{ role: "user", content: "a" }], model: "explicit-m" });
    expect(provider.lastRequest?.model).toBe("explicit-m");

    await factory.chat({ messages: [{ role: "user", content: "b" }], tier: "balanced" });
    expect(provider.lastRequest?.tier).toBe("balanced");
  });

  it("provider models stay per-provider: groq and anthropic map the same tier differently", () => {
    const groq = new GroqProvider({ apiKey: "g" });
    const anthropic = new AnthropicProvider({ apiKey: "a" });
    expect(groq.resolveModel("balanced")).not.toBe(anthropic.resolveModel("balanced"));
    expect(groq.resolveModel("balanced")).toContain("llama");
    expect(anthropic.resolveModel("balanced")).toBe("claude-sonnet-5-5");
  });

  it("chat with zero text providers fails with a config-flavored error", async () => {
    const factory = createAI({});
    await expect(
      factory.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ type: "MISSING_CONFIG" });
  });
});

interface FakeProviderShape {
  id: string;
  name: string;
  capabilities: readonly ("text")[];
  lastRequest: { model?: string; tier?: string; messages: unknown } | null;
  healthCheck(): Promise<"healthy">;
  estimateCost(): Promise<number>;
  resolveModel(tier: string): string;
  generate(request: { model?: string; tier?: string; messages: unknown }): Promise<{
    text: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
    providerId: string;
    finishReason: "stop";
  }>;
  generateStructured<T>(): Promise<{
    value: T;
    result: { text: string; model: string; providerId: string };
  }>;
  stream(
    request: unknown,
    callbacks: { onChunk?: (t: string) => void },
  ): Promise<{ text: string; model: string; providerId: string }>;
}

function createFakeProvider(
  id: string,
  tiers: Record<string, string>,
): FakeProviderShape & { lastRequest: FakeProviderShape["lastRequest"] } {
  return {
    id,
    name: `Fake ${id}`,
    capabilities: ["text"],
    lastRequest: null,
    async healthCheck() {
      return "healthy";
    },
    async estimateCost() {
      return 0;
    },
    resolveModel(tier) {
      return tiers[tier] ?? tiers.balanced;
    },
    async generate(request) {
      this.lastRequest = request;
      return {
        text: "ok",
        usage: { inputTokens: 1, outputTokens: 1 },
        model: request.model ?? this.resolveModel(request.tier ?? "balanced"),
        providerId: id,
        finishReason: "stop",
      };
    },
    async generateStructured() {
      return {
        value: {} as never,
        result: { text: "{}", model: tiers.balanced ?? "m", providerId: id },
      };
    },
    async stream(_request, callbacks) {
      callbacks.onChunk?.("ok");
      return { text: "ok", model: "m", providerId: id };
    },
  } as FakeProviderShape & { lastRequest: FakeProviderShape["lastRequest"] };
}
