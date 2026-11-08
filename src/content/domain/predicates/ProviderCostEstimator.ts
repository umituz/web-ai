
import type { ImageGenerationRequest, TextGenerationRequest, VideoGenerationRequest } from '../config/ProviderConfig';

const FAL_FIXED_COST = 1;
const GROQ_FREE_TIER_COST = 0;
const GEMINI_IMAGE_COST = 0.02;
const GEMINI_TEXT_PER_1K_CHARS_COST = 0.0001;
const PRUNA_FIXED_COST = 1;
const UNKNOWN_PROVIDER_COST = 0;

export function estimateGroqGenerationCost(
  _request?: TextGenerationRequest | ImageGenerationRequest | VideoGenerationRequest,
): number {
  return GROQ_FREE_TIER_COST;
}

export function estimateFalGenerationCost(
  _request?: ImageGenerationRequest | VideoGenerationRequest,
): number {
  return FAL_FIXED_COST;
}

export function estimateGeminiGenerationCost(
  request: TextGenerationRequest | ImageGenerationRequest,
): number {
  if (request.type === 'image') return GEMINI_IMAGE_COST;
  return GEMINI_TEXT_PER_1K_CHARS_COST;
}

export function estimatePrunaGenerationCost(): number {
  return PRUNA_FIXED_COST;
}

export function estimateUnknownProviderCost(): number {
  return UNKNOWN_PROVIDER_COST;
}
