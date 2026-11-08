import { describe, expect, it } from "vitest";
import { GroqChatRequestBuilder } from "../../src/providers/groq/groq-request.builder";

describe("GroqChatRequestBuilder", () => {
  it("maps reasoningEffort to reasoning_effort", () => {
    const request = GroqChatRequestBuilder.for("openai/gpt-oss-120b")
      .withMessages([{ role: "user", content: "hi" }])
      .withConfig({ reasoningEffort: "low" })
      .build();

    expect(request.reasoning_effort).toBe("low");
  });

  it("omits reasoning_effort when not configured", () => {
    const request = GroqChatRequestBuilder.for("openai/gpt-oss-120b")
      .withMessages([{ role: "user", content: "hi" }])
      .withConfig({ temperature: 0.3 })
      .build();

    expect("reasoning_effort" in request).toBe(false);
    expect(request.temperature).toBe(0.3);
  });

  it("marks streaming requests", () => {
    const request = GroqChatRequestBuilder.for("openai/gpt-oss-120b")
      .withMessages([{ role: "user", content: "hi" }])
      .withStream(true)
      .build();

    expect(request.stream).toBe(true);
  });
});
