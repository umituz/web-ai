
import type { TextTier } from '../../core/types';

/**
 * Structural types for Cloudflare Workers AI — no @cloudflare/workers-types
 * dependency, exactly like the apps that consume this package. A binding is
 * "anything with run(model, input)"; the env is "anything that may carry an
 * optional AI binding", so `{ AI?: ... }` app envs satisfy it as-is.
 */
export interface WorkersAIBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface WorkersAIEnv {
  AI?: WorkersAIBinding;
}

/** Chat message shape the Workers AI text models speak (OpenAI convention). */
export interface WorkersAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Error carrying the provider status when one exists (route → HTTP code). */
export class WorkersAIError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'WorkersAIError';
    this.status = status;
  }
}

/** Constructor config for the class-based provider (createAI wiring). */
export interface WorkersAIProviderConfig {
  /** The `env.AI` binding — its presence IS the enabled flag (no apiKey). */
  binding: WorkersAIBinding;
  /** Per-tier model overrides; defaults live in WORKERS_AI_TIERS. */
  models?: Partial<Record<TextTier, string>>;
}
