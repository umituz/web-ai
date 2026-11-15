import type { TierModelMap } from "../../core/tiers";

/**
 * Wire-neutral config for any OpenAI-compatible chat-completions endpoint:
 * OpenAI itself, Groq, OpenRouter, vLLM, LiteLLM, or a Cloudflare AI Gateway
 * in front of any of them. Two URL shapes are accepted because gateways hand
 * out both: `baseUrl` (the API root, `/chat/completions` appended) or
 * `endpointUrl` (the complete chat-completions URL, which wins).
 *
 * Model choice: `model` pins every request to one id — the single-model
 * gateway case; `models` maps the neutral tiers (fast/balanced/powerful) the
 * way the named providers do. Explicit `model` on a request still overrides
 * both, as everywhere in the package.
 */
export interface OpenAiCompatibleProviderConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly endpointUrl?: string;
  readonly model?: string;
  readonly models?: TierModelMap;
  readonly timeoutMs?: number;
}
