/**
 * Adapter resolver — maps a provider binding to a concrete adapter.
 *
 * Apps that keep their provider catalog in a database (base URL + adapter
 * kind + the *name* of the env var holding the key) all end up writing the
 * same switch. This module is that switch, next to the adapters it
 * instantiates: resolve the API key from the environment, pick the adapter
 * kind, enforce which kinds support which capability.
 */
import { AiError } from "../../core/errors";
import { createOpenAiAudioTranscriptionAdapter } from "../audio/audio-transcription";
import type { AudioTranscriptionAdapter } from "../audio/audio-transcription";
import { createOpenAiSpeechAdapter } from "../audio/speech-synthesis";
import type { SpeechAdapter } from "../audio/speech-synthesis";
import { createOpenAiEmbeddingsAdapter } from "../embeddings/openai-embeddings";
import type { EmbeddingsAdapter } from "../embeddings/openai-embeddings";
import { createOpenAiImageAdapter } from "../images/openai-images";
import type { ImageAdapter } from "../images/openai-images";
import { createAnthropicAdapter } from "./anthropic.adapter";
import { createOpenAiCompatibleAdapter } from "./openai-compatible.adapter";
import type { ChatAdapter } from "./adapter.types";

export const ADAPTER_TIMEOUT_MS = 60_000;
export const ADAPTER_MEDIA_TIMEOUT_MS = 120_000;

/** Binding with the key already resolved — for apps that source keys from
 *  somewhere other than the process/request environment (KV, secrets
 *  manager, unit tests). */
export interface AdapterProviderBinding {
  readonly adapter: string;
  readonly baseUrl: string;
  readonly apiKey: string;
}

/** Binding naming an environment variable — the common case for Workers. */
export interface AdapterEnvBinding {
  readonly adapter: string;
  readonly baseUrl: string;
  readonly apiKeyEnv: string;
}

export interface AdapterResolverTiming {
  /** Chat/embeddings/transcription timeout; default 60s. */
  readonly timeoutMs?: number;
  /** Image/speech timeout; default 120s (generation is slower). */
  readonly mediaTimeoutMs?: number;
}

/** Read an API key from an env-like object; throws `AiError('missing_key')`
 *  when unset or blank. */
export function resolveApiKey(env: object, apiKeyEnv: string): string {
  const value = (env as Record<string, string | undefined>)[apiKeyEnv];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AiError("missing_key");
  }
  return value.trim();
}

/** Non-throwing availability probe for provider filtering. */
export function apiKeyAvailable(env: object, apiKeyEnv: string): boolean {
  try {
    resolveApiKey(env, apiKeyEnv);
    return true;
  } catch {
    return false;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function openAiApiKey(binding: AdapterProviderBinding, capability: string): string {
  if (binding.adapter !== "openai-compatible") {
    throw new AiError(
      "model_unavailable",
      `Adapter kind does not support ${capability}: ${binding.adapter}`,
    );
  }
  return binding.apiKey;
}

/** Chat adapter for either supported kind (openai-compatible, anthropic). */
export function chatAdapterFor(
  binding: AdapterProviderBinding,
  timing: AdapterResolverTiming = {},
): ChatAdapter {
  const timeoutMs = timing.timeoutMs ?? ADAPTER_TIMEOUT_MS;
  if (binding.adapter === "openai-compatible") {
    return createOpenAiCompatibleAdapter({
      baseUrl: normalizeBaseUrl(binding.baseUrl),
      apiKey: binding.apiKey,
      timeoutMs,
    });
  }
  if (binding.adapter === "anthropic") {
    return createAnthropicAdapter({
      baseUrl: normalizeBaseUrl(binding.baseUrl),
      apiKey: binding.apiKey,
      timeoutMs,
    });
  }
  throw new AiError("model_unavailable", `Unsupported adapter kind: ${binding.adapter}`);
}

/** Image generation (openai-compatible only). */
export function imageAdapterFor(
  binding: AdapterProviderBinding,
  timing: AdapterResolverTiming = {},
): ImageAdapter {
  return createOpenAiImageAdapter({
    baseUrl: normalizeBaseUrl(binding.baseUrl),
    apiKey: openAiApiKey(binding, "images"),
    timeoutMs: timing.mediaTimeoutMs ?? ADAPTER_MEDIA_TIMEOUT_MS,
  });
}

/** Text embeddings (openai-compatible only). */
export function embeddingsAdapterFor(
  binding: AdapterProviderBinding,
  timing: AdapterResolverTiming = {},
): EmbeddingsAdapter {
  return createOpenAiEmbeddingsAdapter({
    baseUrl: normalizeBaseUrl(binding.baseUrl),
    apiKey: openAiApiKey(binding, "embeddings"),
    timeoutMs: timing.timeoutMs ?? ADAPTER_TIMEOUT_MS,
  });
}

/** Audio transcription (openai-compatible only). */
export function audioTranscriptionAdapterFor(
  binding: AdapterProviderBinding,
  timing: AdapterResolverTiming = {},
): AudioTranscriptionAdapter {
  return createOpenAiAudioTranscriptionAdapter({
    baseUrl: normalizeBaseUrl(binding.baseUrl),
    apiKey: openAiApiKey(binding, "audio transcription"),
    timeoutMs: timing.timeoutMs ?? ADAPTER_TIMEOUT_MS,
  });
}

/** Speech synthesis (openai-compatible only). */
export function speechAdapterFor(
  binding: AdapterProviderBinding,
  timing: AdapterResolverTiming = {},
): SpeechAdapter {
  return createOpenAiSpeechAdapter({
    baseUrl: normalizeBaseUrl(binding.baseUrl),
    apiKey: openAiApiKey(binding, "speech synthesis"),
    timeoutMs: timing.mediaTimeoutMs ?? ADAPTER_MEDIA_TIMEOUT_MS,
  });
}

export interface AdapterResolver {
  chat(binding: AdapterEnvBinding): ChatAdapter;
  image(binding: AdapterEnvBinding): ImageAdapter;
  embeddings(binding: AdapterEnvBinding): EmbeddingsAdapter;
  audioTranscription(binding: AdapterEnvBinding): AudioTranscriptionAdapter;
  speech(binding: AdapterEnvBinding): SpeechAdapter;
  available(binding: AdapterEnvBinding): boolean;
}

/**
 * Bind the resolver to one environment object (a Workers `env`, a request
 * context, a test fixture) and hand out adapters per provider row.
 */
export function createAdapterResolver(
  env: object,
  timing: AdapterResolverTiming = {},
): AdapterResolver {
  const toProviderBinding = (binding: AdapterEnvBinding): AdapterProviderBinding => ({
    adapter: binding.adapter,
    baseUrl: binding.baseUrl,
    apiKey: resolveApiKey(env, binding.apiKeyEnv),
  });

  return {
    chat: (binding) => chatAdapterFor(toProviderBinding(binding), timing),
    image: (binding) => imageAdapterFor(toProviderBinding(binding), timing),
    embeddings: (binding) => embeddingsAdapterFor(toProviderBinding(binding), timing),
    audioTranscription: (binding) =>
      audioTranscriptionAdapterFor(toProviderBinding(binding), timing),
    speech: (binding) => speechAdapterFor(toProviderBinding(binding), timing),
    available: (binding) => apiKeyAvailable(env, binding.apiKeyEnv),
  };
}
