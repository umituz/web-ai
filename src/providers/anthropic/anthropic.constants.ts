
import type { TierModelMap } from "../../core/tiers";

export const ANTHROPIC_MODELS = {
  OPUS_5_5: "claude-opus-5-5",
  SONNET_5_5: "claude-sonnet-5-5",
  HAIKU_5_5: "claude-haiku-5-5",
} as const;

/**
 * Neutral tier → Claude model. fast = Haiku for cheap high-volume turns,
 * balanced = Sonnet for everyday quality, powerful = Opus for the heavy
 * lifting. Override per instance via `models` in provider config.
 */
export const ANTHROPIC_TIERS: TierModelMap = {
  fast: ANTHROPIC_MODELS.HAIKU_5_5,
  balanced: ANTHROPIC_MODELS.SONNET_5_5,
  powerful: ANTHROPIC_MODELS.OPUS_5_5,
};

/**
 * Single bump point for the wire protocol version. Every request sends this
 * as the `anthropic-version` header; the shapes in anthropic.entities.ts are
 * pinned to it.
 */
export const ANTHROPIC_API_VERSION = "2026-10-21" as const;

/** The Messages API requires max_tokens on every request. */
export const ANTHROPIC_DEFAULT_MAX_TOKENS = 16000;

export const ANTHROPIC_BASE_URL = "https://api.anthropic.com" as const;
export const ANTHROPIC_MESSAGES_PATH = "/v1/messages" as const;
export const ANTHROPIC_MODELS_PATH = "/v1/models" as const;

export const ANTHROPIC_TIMEOUTS = {
  DEFAULT: 60000,
  STREAMING: 120000,
} as const;

export const ANTHROPIC_HEADERS = {
  CONTENT_TYPE: "Content-Type",
  APPLICATION_JSON: "application/json",
  API_KEY: "x-api-key",
  VERSION: "anthropic-version",
} as const;

/**
 * Default reasoning effort per model family. Opus and Haiku default to
 * medium; Sonnet benefits from high. Requests can override via
 * `output_config.effort` — the builder applies these defaults only when the
 * request says nothing.
 */
export const ANTHROPIC_DEFAULT_EFFORT = {
  [ANTHROPIC_MODELS.OPUS_5_5]: "medium",
  [ANTHROPIC_MODELS.SONNET_5_5]: "high",
  [ANTHROPIC_MODELS.HAIKU_5_5]: "medium",
} as const;

export type AnthropicEffort = "low" | "medium" | "high";
