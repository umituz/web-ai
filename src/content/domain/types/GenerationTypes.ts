
export type { AspectRatio, ImageQuality, VideoQuality, MotionStrength } from '../limits/ImageFormatOptions';

export type GenerationType = 'text-to-image' | 'image-to-image' | 'image-to-video' | 'text-to-video';

export type GenerationStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';

import type { AspectRatio, ImageQuality, VideoQuality, MotionStrength } from '../limits/ImageFormatOptions';

export interface ImageGenerationInput {
  type: 'text-to-image' | 'image-to-image';
  prompt: string;
  image?: string;
  aspectRatio?: AspectRatio;
  quality?: ImageQuality;
  style?: string;
  seed?: number;
}

export interface VideoGenerationInput {
  type: 'text-to-video' | 'image-to-video';
  prompt: string;
  image?: string;
  duration?: number;
  aspectRatio?: AspectRatio;
  quality?: VideoQuality;
  motion?: MotionStrength;
}

export interface GenerationResult {
  id: string;
  type: GenerationType;
  url: string;
  thumbnailUrl?: string;
  status: GenerationStatus;
  error?: string;
  metadata?: GenerationMetadata;
  createdAt: string;
}

export interface GenerationMetadata {
  provider: 'pruna' | 'fal' | 'groq' | 'gemini';
  model: string;
  prompt: string;
  duration?: number;
  quality?: string;
  aspectRatio?: string;
  style?: string;
}

export interface GenerationProgress {
  stage: 'uploading' | 'processing' | 'polling';
  progress: number;
  message?: string;
}

export interface CreditCost {
  standard: number;
  hd: number;
  '4k': number;
}

export { CREDIT_COSTS as GENERATION_COSTS, calculateContentCreditCost as calculateCreditCost } from '../calculations/ContentCreditCost';
