# @umituz/web-ai

Provider-agnostic AI engine for web and edge runtimes. Text, chat, structured
output and streaming over swappable providers — **switching Claude ↔ Groq ↔
Gemini is a config edit, not a code change.**

Merges and supersedes `@umituz/web-ai-groq-provider` (engine: dedupe/retry/
queue, cache, SSE bridge, chat domain) and `@umituz/web-ai-content` (content
generation suite, wizards, React hooks) into one provider-neutral package.

```bash
npm i @umituz/web-ai
```

## Quick start

```ts
import { createAI } from "@umituz/web-ai";

const ai = createAI({
  anthropic: { apiKey: env.ANTHROPIC_API_KEY }, // registered when apiKey present
  groq: { apiKey: env.GROQ_API_KEY },
  priority: ["anthropic", "groq"], // fallback walk order
  defaultTier: "balanced",
});

const result = await ai.chat({
  messages: [{ role: "user", content: "What units are available?" }],
  systemPrompt: "You are a real-estate assistant.",
  maxTokens: 2048,
});

result.text;        // "Two 2-bedroom units…"
result.usage;       // { inputTokens, outputTokens } — never discarded
result.model;       // e.g. claude-sonnet-5-5
result.finishReason; // "stop" | "length" | "content_filter" | "refusal"
```

Swap providers by editing config only — the code above is untouched:

```ts
const ai = createAI({ groq: { apiKey: env.GROQ_API_KEY } }); // now served by Groq
```

## Tiers, not model IDs

Requests name a **tier** (`fast` | `balanced` | `powerful`); each provider
maps it onto its own catalogue (Anthropic: haiku/sonnet/opus · Groq:
8b/70b/120b · Gemini: flash-lite/flash/pro). An explicit `model` on a request
overrides the tier. Per-instance overrides via each provider's `models` block.

Streaming is callback-based, with an async-generator adapter when you prefer it:

```ts
const result = await ai.chatStream(request, { onChunk: (t) => render(t) });

for await (const chunk of ai.streamText(request)) render(chunk);
```

## Entries

| Entry | Contents | React? |
|---|---|---|
| `@umituz/web-ai` | `createAI`, `ProviderFactory`, providers, core types — **root is Workers-safe** | no |
| `/core` | errors, executor strategies (dedupe→retry→queue), cache, SSE bridge, tiers, usage analytics, remote chat client | no |
| `/providers` | provider classes + factory, adapter resolver, `runConversation` | no |
| `/chat` | `ChatService`, chat entities, `IChatStorage` | no |
| `/content` | content domain, 9 services, `PromptBuilder`, `GenerationExecutor` | no |
| `/wizard` | content wizard flows | no |
| `/hooks` | React hooks: `useChat`, `useText`, `useRemoteChat`, `useAIContent`, wizards… | **yes** |

React and `@umituz/pruna-provider` are optional peer dependencies — install
them only if you use `/hooks` or the Pruna media provider.

## Server-side chat endpoints

The pieces a backend-proxy chat stack needs, all persistence-free:

- `runConversation(input)` — the turn engine: ordered failover attempts over
  `ChatAdapter`s, per-attempt context windowing (`buildContext`), answer /
  reasoning / usage / tool-call reduction, abort → `stopped`. Yield events and
  persist them your way.
- `sseStreamResponse(events)` / `replayFirst` — wrap the generator into an SSE
  `Response` (Workers/hono compatible).
- `createAdapterResolver(env)` — provider binding (`{ adapter, baseUrl,
  apiKeyEnv }`) → concrete adapter, for chat/image/embeddings/transcription/
  speech, with `available()` probing.
- `AI_ERROR_STATUS` / `aiErrorStatus(code)` — map `AiErrorCode` onto HTTP
  statuses for route error handling.
- `buildUsageDailySeries` / `usageWindowTotals` / `usageTrendOf` /
  `errorRatePct` — turn sparse SQL day aggregates into zero-filled usage
  series and dashboard math.
- `deriveConversationTitle(content, { fallback, maxChars })` — first-line
  title derivation for new conversations (Markdown prefix strip, collapse,
  truncate).
- `planStuckRecovery(task, now)` / `STUCK_TASK_THRESHOLD_MS` — recovery
  decision for queue rows found stale in `running`; sits next to
  `canStartTask` / `planTaskFailure`.

## Client-side chat over your own backend

`createRemoteChatClient({ urls })` POSTs to your chat endpoint and replays the
SSE stream (`streamChat`, `resolveToolCall`); `useRemoteChat({ client })`
owns the message-list state machine — optimistic user echo, streaming
placeholder, delta/usage/error/done patches, tool approval, abort tracking.

## Migration from the old packages

One screen, both ancestors:

| Before | After |
|---|---|
| `configureProvider({...})` singleton | `createAI(config)` → per-app `ProviderFactory` instance |
| `new GroqProvider()` + manual client wiring | `createAI({ groq: { apiKey } })` (or import the class from `/providers`) |
| `GroqError` / `GroqErrorType` | `AIError` / `AIErrorType` — same semantic codes (`INVALID_API_KEY`, `RATE_LIMIT`, …) |
| `IAIProvider` with `'multimodal'` flag | `ITextProvider` / `IMediaProvider` with `capabilities: ('text'\|'image'\|'video')[]` |
| Model IDs hardcoded per call | `tier: 'fast'\|'balanced'\|'powerful'` (explicit `model` still wins) |
| Services returned `string`, token usage dropped | `GenerationResult { text, usage?, model, providerId, finishReason? }` |
| `generateText(prompt)` string API (content services) | Unchanged — factory keeps the string facade |
| `useGroq({ apiKey, model })` | `useText({ config })` or `useText({}, { engine })` |
| `useAIContent({ apiKey, model })` | `useAIContent({ config })` (`AIProviderConfig`, legacy `ProviderConfig` still accepted) |
| `toGroqMessages(messages)` | `toCoreMessages(messages)` (internal; `messageFormatter` is public) |
| SSE chat endpoint wiring | `createSseResponse(stream, { extractDelta, ... })` — same, now provider-neutral |

Content services (`AIContentService`, `GenerationExecutor`, wizards) compile
against the same public API; only construction changed — pass `AIProviderConfig`
instead of wiring a generator.

## License

MIT © umituz
