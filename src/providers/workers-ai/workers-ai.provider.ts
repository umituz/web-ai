
import type {
  GenerationResult,
  ProviderHealth,
  StreamCallbacks,
  StructuredGeneration,
  StructuredTextRequest,
  TextRequest,
  TextTier,
} from '../../core/types';
import { AIError, AIErrorType } from '../../core/errors';
import { JsonResponseParser, StructuredPromptBuilder } from '../../core/parsers';
import { mergeTierOverrides, resolveModel, type TierModelMap } from '../../core/tiers';
import type { CostEstimateRequest, ITextProvider } from '../base/provider.types';
import { WorkersAIError, type WorkersAIProviderConfig } from './workers-ai.entities';
import { runWorkersAIText, streamWorkersAIText, WORKERS_AI_LLM_MODEL } from './workers-ai.text';

/**
 * Tier defaults for the Workers AI catalogue. `fast` drops to the 8b
 * fp8-fast deployment; `balanced` and `powerful` share the 70b model —
 * it is the top instruct text model the catalogue offers today, so a
 * `powerful` request is served honestly rather than failing the tier walk.
 */
export const WORKERS_AI_TIERS: TierModelMap = {
  fast: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  balanced: WORKERS_AI_LLM_MODEL,
  powerful: WORKERS_AI_LLM_MODEL,
};

/**
 * Cloudflare Workers AI text provider over the `env.AI` binding. There is
 * no apiKey and no fetch — the binding IS the transport, so this provider
 * skips BaseProvider's fetch machinery (like the transport-owning Groq and
 * Anthropic providers do) and implements IProviderBase directly.
 *
 * `createAI({ workersAI: { binding: env.AI } })` registers it when the
 * binding is present; an absent binding never registers, so unconfigured
 * deployments fail over down the priority walk instead of erroring.
 */
export class WorkersAIProvider implements ITextProvider {
  readonly id = 'workers-ai';
  readonly name = 'Cloudflare Workers AI';
  readonly capabilities = ['text'] as const;

  private readonly binding: WorkersAIProviderConfig['binding'];
  private readonly tiers: TierModelMap;
  private readonly jsonParser = new JsonResponseParser();

  constructor(config: WorkersAIProviderConfig) {
    this.binding = config.binding;
    this.tiers = mergeTierOverrides(WORKERS_AI_TIERS, config.models);
  }

  resolveModel(tier: TextTier): string {
    return resolveModel(this.tiers, tier, this.id);
  }

  async healthCheck(): Promise<ProviderHealth> {
    return typeof this.binding?.run === 'function' ? 'healthy' : 'unavailable';
  }

  /** Workers AI is allocation-priced (neurons per deployment), not per
   *  request — there is no per-call cost to estimate. */
  async estimateCost(_request: CostEstimateRequest): Promise<number> {
    return 0;
  }

  async generate(request: TextRequest): Promise<GenerationResult> {
    const model = request.model ?? this.resolveModel(request.tier ?? 'balanced');
    const messages = withSystemPrompt(request);

    try {
      const text = await runWorkersAIText(
        { AI: this.binding },
        messages,
        {
          model,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        },
      );
      return { text, model, providerId: this.id, finishReason: 'stop' };
    } catch (error) {
      throw toAIError(error);
    }
  }

  async generateStructured<T>(request: StructuredTextRequest): Promise<StructuredGeneration<T>> {
    const messages = [...request.messages];
    const lastUserIndex = findLastIndex(messages, (m) => m.role === 'user');
    if (lastUserIndex === -1) {
      throw new AIError(AIErrorType.UNKNOWN_ERROR, 'generateStructured requires at least one user message');
    }
    messages[lastUserIndex] = {
      role: 'user',
      content: new StructuredPromptBuilder(messages[lastUserIndex]?.content ?? '')
        .withSchema(request.schema)
        .build(),
    };

    const result = await this.generate({ ...request, messages, temperature: 0.1 });
    return { value: this.jsonParser.parse<T>(result.text), result };
  }

  async stream(request: TextRequest, callbacks: StreamCallbacks): Promise<GenerationResult> {
    const model = request.model ?? this.resolveModel(request.tier ?? 'balanced');
    const messages = withSystemPrompt(request);

    let text = '';
    try {
      for await (const chunk of streamWorkersAIText({ AI: this.binding }, messages, {
        model,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      })) {
        text += chunk;
        callbacks.onChunk?.(chunk);
      }
    } catch (error) {
      const aiError = toAIError(error);
      callbacks.onError?.(aiError);
      throw aiError;
    }
    const result: GenerationResult = { text, model, providerId: this.id, finishReason: 'stop' };
    callbacks.onComplete?.(result);
    return result;
  }
}

/** Top-level systemPrompt wins over in-band system roles; absent → messages
 *  pass through untouched (llama-3 works with or without a system turn). */
function withSystemPrompt(request: TextRequest): ReadonlyArray<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  if (request.systemPrompt && request.systemPrompt.length > 0) {
    return [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.filter((m) => m.role !== 'system'),
    ];
  }
  return request.messages;
}

function toAIError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  const message = error instanceof Error ? error.message : 'Workers AI request failed';
  const type = error instanceof WorkersAIError && error.message.includes('not configured')
    ? AIErrorType.INVALID_API_KEY
    : AIErrorType.SERVER_ERROR;
  return new AIError(type, message, error instanceof Error ? error : undefined);
}

function findLastIndex<T>(items: ReadonlyArray<T>, predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item !== undefined && predicate(item)) return i;
  }
  return -1;
}

export function createWorkersAIProvider(config: WorkersAIProviderConfig): WorkersAIProvider {
  return new WorkersAIProvider(config);
}
