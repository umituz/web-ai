import { AiError } from '../errors/unified-ai-error';

export interface GenerationSettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
}

export const GENERATION_BOUNDS = {
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
} as const;

export const DEFAULT_GENERATION: Required<GenerationSettings> = {
  temperature: 0.7,
  maxOutputTokens: 4096,
  topP: 1,
};

function cleanUndefined(obj: GenerationSettings | undefined): Partial<GenerationSettings> {
  const out: Partial<GenerationSettings> = {};
  if (!obj) return out;
  if (obj.temperature !== undefined) out.temperature = obj.temperature;
  if (obj.maxOutputTokens !== undefined) out.maxOutputTokens = obj.maxOutputTokens;
  if (obj.topP !== undefined) out.topP = obj.topP;
  return out;
}

export function normalizeGenerationSettings(
  requested: GenerationSettings | undefined,
  maxModelTokens: number = DEFAULT_GENERATION.maxOutputTokens,
): Required<GenerationSettings> {
  const merged = {
    ...DEFAULT_GENERATION,
    ...cleanUndefined(requested),
  };
  const { temperature, topP } = GENERATION_BOUNDS;

  if (merged.temperature < temperature.min || merged.temperature > temperature.max) {
    throw new AiError(
      'invalid_request',
      `temperature must be between ${temperature.min} and ${temperature.max}`,
    );
  }
  if (merged.topP < topP.min || merged.topP > topP.max) {
    throw new AiError('invalid_request', `topP must be between ${topP.min} and ${topP.max}`);
  }
  if (!Number.isInteger(merged.maxOutputTokens) || merged.maxOutputTokens < 1) {
    throw new AiError('invalid_request', 'maxOutputTokens must be a positive integer');
  }
  let maxOutputTokens = merged.maxOutputTokens;
  if (maxOutputTokens > maxModelTokens && maxModelTokens > 0) {
    maxOutputTokens = maxModelTokens;
  }
  return {
    temperature: merged.temperature,
    maxOutputTokens,
    topP: merged.topP,
  };
}
