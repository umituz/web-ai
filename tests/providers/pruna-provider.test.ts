import { describe, expect, it, vi } from "vitest";
import { PrunaProvider } from "../../src/providers/pruna/pruna.provider";
import * as prunaModule from "../../src/providers/pruna/pruna-generate";

describe("PrunaProvider", () => {
  it("reports healthy when apiKey is present and unavailable when missing", async () => {
    const withKey = new PrunaProvider({ apiKey: "key", enabled: true });
    expect(await withKey.healthCheck()).toBe("healthy");

    const withoutKey = new PrunaProvider({ apiKey: "", enabled: true });
    expect(await withoutKey.healthCheck()).toBe("unavailable");
  });

  it("generates image via generateWithPruna", async () => {
    const provider = new PrunaProvider({ apiKey: "test-key", enabled: true });

    vi.spyOn(prunaModule, "generateWithPruna").mockImplementation(async function* () {
      yield { stage: "processing" };
      yield {
        stage: "predicting",
        result: { url: "https://pruna.ai/image.png", model: "p-image" },
      };
    });

    const result = await provider.generateImage({
      type: "image",
      prompt: "A neon cat",
    });

    expect(result.type).toBe("image");
    expect(result.url).toBe("https://pruna.ai/image.png");
    expect(result.metadata?.provider).toBe("pruna");
  });

  it("generates video via generateWithPruna", async () => {
    const provider = new PrunaProvider({ apiKey: "test-key", enabled: true });

    vi.spyOn(prunaModule, "generateWithPruna").mockImplementation(async function* () {
      yield { stage: "processing" };
      yield {
        stage: "predicting",
        result: { url: "https://pruna.ai/video.mp4", model: "p-video" },
      };
    });

    const result = await provider.generateVideo({
      type: "video",
      prompt: "Drone flyover",
      duration: 5,
    });

    expect(result.type).toBe("video");
    expect(result.url).toBe("https://pruna.ai/video.mp4");
  });

  it("generates imageToVideo via generateWithPruna", async () => {
    const provider = new PrunaProvider({ apiKey: "test-key", enabled: true });

    vi.spyOn(prunaModule, "generateWithPruna").mockImplementation(async function* () {
      yield { stage: "processing" };
      yield {
        stage: "predicting",
        result: { url: "https://pruna.ai/animated.mp4", model: "p-image-to-video" },
      };
    });

    const result = await provider.imageToVideo({
      type: "video",
      imageUrl: "https://pruna.ai/source.png",
      prompt: "Add waves",
    });

    expect(result.type).toBe("video");
    expect(result.url).toBe("https://pruna.ai/animated.mp4");
  });

  it("rejects videoToVideo with client error", async () => {
    const provider = new PrunaProvider({ apiKey: "test-key", enabled: true });
    await expect(
      provider.videoToVideo({
        type: "video",
        sourceVideoUrl: "https://pruna.ai/input.mp4",
        prompt: "anime style",
      }),
    ).rejects.toThrow("does not support video-to-video");
  });
});
