import { describe, expect, it } from "vitest";
import { interpolatePrompt } from "../../src/core/prompt/prompt-template";

describe("interpolatePrompt", () => {
  it("interpolates simple variables with double and single curly braces", () => {
    const template = "Hello {{name}}, welcome to {place}!";
    const result = interpolatePrompt(template, { name: "Alice", place: "Wonderland" });
    expect(result).toBe("Hello Alice, welcome to Wonderland!");
  });

  it("handles nested properties with dot notation", () => {
    const template = "User: {{user.profile.displayName}} ({{user.id}})";
    const result = interpolatePrompt(template, {
      user: {
        id: 42,
        profile: {
          displayName: "SuperCoder",
        },
      },
    });
    expect(result).toBe("User: SuperCoder (42)");
  });

  it("handles missing variables according to missingVarHandler option", () => {
    const template = "Hello {{name}}, code: {{code}}";

    expect(interpolatePrompt(template, { name: "Bob" })).toBe("Hello Bob, code: {{code}}");

    expect(
      interpolatePrompt(template, { name: "Bob" }, { missingVarHandler: "empty" }),
    ).toBe("Hello Bob, code: ");

    expect(() =>
      interpolatePrompt(template, { name: "Bob" }, { missingVarHandler: "throw" }),
    ).toThrow("Missing required prompt variable: code");
  });
});
