import { describe, expect, it } from "vitest";
import {
  AnthropicRequestBuilder,
  BUILDER_DEFAULT_MAX_TOKENS,
  defaultEffortForModel,
} from "../../src/providers/anthropic/anthropic-request.builder";
import { ANTHROPIC_MODELS } from "../../src/providers/anthropic/anthropic.constants";

describe("AnthropicRequestBuilder", () => {
  it("always sets max_tokens — defaulting when the request omits it", () => {
    const request = new AnthropicRequestBuilder(ANTHROPIC_MODELS.SONNET_5_5)
      .withRequest({ messages: [{ role: "user", content: "hi" }] })
      .build();
    expect(request.max_tokens).toBe(BUILDER_DEFAULT_MAX_TOKENS);
  });

  it("honors an explicit max_tokens", () => {
    const request = new AnthropicRequestBuilder(ANTHROPIC_MODELS.HAIKU_5_5)
      .withRequest({ messages: [{ role: "user", content: "hi" }], maxTokens: 2048 })
      .build();
    expect(request.max_tokens).toBe(2048);
  });

  it("NEVER emits temperature or top_p — this API version rejects them with a 400", () => {
    const request = new AnthropicRequestBuilder(ANTHROPIC_MODELS.SONNET_5_5)
      .withRequest({
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.9,
        topP: 0.8,
      })
      .build();
    const wire = request as unknown as Record<string, unknown>;
    expect("temperature" in wire).toBe(false);
    expect("top_p" in wire).toBe(false);
    expect(wire.temperature).toBeUndefined();
    expect(wire.top_p).toBeUndefined();
  });

  it("maps systemPrompt to the top-level system slot, not an in-band message", () => {
    const request = new AnthropicRequestBuilder(ANTHROPIC_MODELS.OPUS_5_5)
      .withRequest({
        messages: [
          { role: "system", content: "folded away" },
          { role: "user", content: "hi" },
        ],
        systemPrompt: "You are a concierge.",
      })
      .build();
    expect(request.system).toBe("You are a concierge.");
    expect(request.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("drops system-role messages from the wire messages entirely", () => {
    const request = new AnthropicRequestBuilder(ANTHROPIC_MODELS.HAIKU_5_5)
      .withRequest({
        messages: [
          { role: "system", content: "inline system" },
          { role: "user", content: "q" },
          { role: "assistant", content: "a" },
          { role: "user", content: "q2" },
        ],
      })
      .build();
    expect(request.messages).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: "a" },
      { role: "user", content: "q2" },
    ]);
  });

  it("applies per-model default effort (sonnet high, opus/haiku medium)", () => {
    const build = (model: string) =>
      new AnthropicRequestBuilder(model)
        .withRequest({ messages: [{ role: "user", content: "hi" }] })
        .build();

    expect(build(ANTHROPIC_MODELS.SONNET_5_5).output_config?.effort).toBe("high");
    expect(build(ANTHROPIC_MODELS.OPUS_5_5).output_config?.effort).toBe("medium");
    expect(build(ANTHROPIC_MODELS.HAIKU_5_5).output_config?.effort).toBe("medium");
    expect(defaultEffortForModel("claude-unknown")).toBe("medium");
  });

  it("lets provider config pin effort over the default", () => {
    const request = new AnthropicRequestBuilder(ANTHROPIC_MODELS.SONNET_5_5)
      .withRequest({ messages: [{ role: "user", content: "hi" }] })
      .withEffort("low")
      .build();
    expect(request.output_config?.effort).toBe("low");
  });

  it("forwards stop sequences and the stream flag", () => {
    const request = new AnthropicRequestBuilder(ANTHROPIC_MODELS.HAIKU_5_5)
      .withRequest({
        messages: [{ role: "user", content: "hi" }],
        stopSequences: ["\n\nHuman:"],
      })
      .withStream(true)
      .build();
    expect(request.stop_sequences).toEqual(["\n\nHuman:"]);
    expect(request.stream).toBe(true);
  });

  it("never emits a thinking block — adaptive thinking is the API default", () => {
    const request = new AnthropicRequestBuilder(ANTHROPIC_MODELS.OPUS_5_5)
      .withRequest({ messages: [{ role: "user", content: "hard problem" }] })
      .build();
    expect("thinking" in (request as unknown as Record<string, unknown>)).toBe(false);
  });
});
