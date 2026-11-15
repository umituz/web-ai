import { describe, expect, it } from "vitest";
import { AiError } from "../../src/core/errors";
import { runConversation } from "../../src/providers/execution/run-conversation";
import type { ConversationEvent } from "../../src/providers/execution/run-conversation";
import type { ChatAdapter, ProviderEvent } from "../../src/providers/adapters/adapter.types";

function adapter(events: ProviderEvent[] | ((req: unknown) => ProviderEvent[]), error?: unknown): ChatAdapter & {
  requests: unknown[];
} {
  const requests: unknown[] = [];
  return {
    requests,
    async *stream(req: never) {
      requests.push(req);
      if (error) throw error;
      const list = typeof events === "function" ? events(req) : events;
      for (const event of list) yield event;
    },
  } as ChatAdapter & { requests: unknown[] };
}

function attemptFor(target: ChatAdapter, contextWindow = 100_000) {
  return {
    adapter: target,
    model: { externalModelId: "model-x", contextWindow },
    settings: { temperature: 0.5, maxOutputTokens: 1024, topP: 1 },
  };
}

async function collect(events: AsyncGenerator<ConversationEvent>): Promise<ConversationEvent[]> {
  const out: ConversationEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

describe("runConversation", () => {
  it("streams deltas and ends with a done result carrying accumulated state", async () => {
    const primary = adapter([
      { type: "delta", channel: "reasoning", text: "hmm " },
      { type: "delta", channel: "answer", text: "Hel" },
      { type: "delta", channel: "answer", text: "lo" },
      { type: "usage", usage: { inputTokens: 4, outputTokens: 2 } },
    ]);

    const events = await collect(
      runConversation({
        history: [{ role: "user", content: "hi" }],
        systemPrompt: "be brief",
        attempts: [attemptFor(primary)],
      }),
    );

    expect(events.map((e) => e.type)).toEqual(["attempt", "delta", "delta", "delta", "done"]);
    const done = events.at(-1) as Extract<ConversationEvent, { type: "done" }>;
    expect(done).toMatchObject({
      type: "done",
      result: {
        answer: "Hello",
        reasoning: "hmm ",
        usage: { inputTokens: 4, outputTokens: 2 },
        toolCalls: [],
      },
    });
    expect(done.result.durationMs).toBeGreaterThanOrEqual(0);

    // request shape passed to the adapter
    const req = primary.requests[0] as Record<string, unknown>;
    expect(req.externalModelId).toBe("model-x");
    expect((req.messages as Array<Record<string, unknown>>)[0]).toMatchObject({
      role: "system",
      content: "be brief",
    });
    expect(req.temperature).toBe(0.5);
  });

  it("emits tool_calls only when tools were offered", async () => {
    const calls = [{ id: "t1", name: "web_search", arguments: "{}" }];
    const withTools = adapter([{ type: "tool_calls", calls }]);
    const events = await collect(
      runConversation({
        history: [],
        systemPrompt: "",
        attempts: [attemptFor(withTools)],
        tools: [{ name: "web_search", description: "", parameters: {} }],
      }),
    );
    expect(events.at(-1)).toMatchObject({ type: "tool_calls", result: { toolCalls: calls } });

    const withoutTools = adapter([{ type: "tool_calls", calls }]);
    const events2 = await collect(
      runConversation({
        history: [],
        systemPrompt: "",
        attempts: [attemptFor(withoutTools)],
      }),
    );
    expect(events2.at(-1)?.type).toBe("done");
  });

  it("failovers to the next attempt on a transient error before anything streamed", async () => {
    const transient = adapter([], new AiError("rate_limited"));
    const healthy = adapter([{ type: "delta", channel: "answer", text: "recovered" }]);

    const events = await collect(
      runConversation({
        history: [],
        systemPrompt: "",
        attempts: [attemptFor(transient), attemptFor(healthy)],
      }),
    );

    expect(events.map((e) => e.type)).toEqual(["attempt", "attempt", "delta", "done"]);
    expect((events.at(-1) as { result: { answer: string } }).result.answer).toBe("recovered");
  });

  it("does not failover when partial output was already streamed", async () => {
    async function* partialThenBoom(): AsyncGenerator<ProviderEvent> {
      yield { type: "delta", channel: "answer", text: "partial" };
      throw new AiError("capacity");
    }
    const leaking: ChatAdapter = { stream: () => partialThenBoom() };
    const never: ChatAdapter & { requests: unknown[] } = adapter([]);

    const events = await collect(
      runConversation({
        history: [],
        systemPrompt: "",
        attempts: [attemptFor(leaking), attemptFor(never)],
      }),
    );

    expect(events.at(-1)).toMatchObject({ type: "failed", code: "capacity" });
    expect((events.at(-1) as { result: { answer: string } }).result.answer).toBe("partial");
    expect(never.requests).toHaveLength(0);
  });

  it("does not failover on non-transient errors", async () => {
    const invalid = adapter([], new AiError("invalid_key"));
    const never = adapter([]);

    const events = await collect(
      runConversation({
        history: [],
        systemPrompt: "",
        attempts: [attemptFor(invalid), attemptFor(never)],
      }),
    );

    expect(events.at(-1)).toMatchObject({ type: "failed", code: "invalid_key" });
    expect(never.requests).toHaveLength(0);
  });

  it("classifies unknown errors via errorFromUnknown", async () => {
    const broken = adapter([], new TypeError("fetch failed"));
    const events = await collect(
      runConversation({ history: [], systemPrompt: "", attempts: [attemptFor(broken)] }),
    );
    expect(events.at(-1)).toMatchObject({ type: "failed", code: "network" });
  });

  it("reports stopped when the signal aborted mid-stream", async () => {
    const controller = new AbortController();
    async function* stream(): AsyncGenerator<ProviderEvent> {
      yield { type: "delta", channel: "answer", text: "so far" };
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    }
    const slow: ChatAdapter = { stream: () => stream() };

    const events = await collect(
      runConversation({
        history: [],
        systemPrompt: "",
        attempts: [attemptFor(slow)],
        signal: controller.signal,
      }),
    );

    expect(events.at(-1)).toMatchObject({ type: "stopped", result: { answer: "so far" } });
  });

  it("windows history to the attempt's context budget", async () => {
    const tiny = adapter([]);
    const history = Array.from({ length: 50 }, (_, i) => ({
      role: "user" as const,
      content: `message number ${i} with some tokens to chew through`,
    }));

    await collect(
      runConversation({
        history,
        systemPrompt: "system",
        attempts: [attemptFor(tiny, 200)],
      }),
    );

    const req = tiny.requests[0] as { messages: unknown[] };
    expect(req.messages.length).toBeLessThan(history.length + 1);
    expect(req.messages.length).toBeGreaterThan(0);
  });
});
