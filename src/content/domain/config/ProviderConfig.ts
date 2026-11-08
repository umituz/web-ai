
export type ProviderHealth = 'healthy' | 'degraded' | 'exhausted' | 'unavailable';

export type ProviderType = 'text' | 'image' | 'video' | 'multimodal';

export interface BaseProviderConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface GroqConfig extends BaseProviderConfig {
  models?: {
    text?: string;
    chat?: string;
  };
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface FalConfig extends BaseProviderConfig {
  models?: {
    image?: string;
    video?: string;
    imageToVideo?: string;
  };
}

export interface PrunaConfig extends BaseProviderConfig {
  models?: {
    textToImage?: string;
    textToVideo?: string;
  };
}

export interface GeminiConfig extends BaseProviderConfig {
  models?: {
    text?: string;
    image?: string;
    video?: string;
  };
}

export interface AnthropicConfig extends BaseProviderConfig {
  models?: {
    fast?: string;
    balanced?: string;
    powerful?: string;
  };
  effort?: 'low' | 'medium' | 'high';
}

export interface ProviderConfig {
  priority: string[];

  anthropic?: AnthropicConfig;
  groq?: GroqConfig;
  fal?: FalConfig;
  pruna?: PrunaConfig;
  gemini?: GeminiConfig;

  fallbackEnabled: boolean;
  retryAttempts: number;
  timeout: number;
}

export interface GenerationRequest {
  type: 'text' | 'image' | 'video';
  provider?: string;
}

export interface TextGenerationRequest extends GenerationRequest {
  type: 'text';
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface ImageGenerationRequest extends GenerationRequest {
  type: 'image';
  prompt: string;
  style?: 'realistic' | 'cartoon' | 'abstract' | 'minimalist' | 'vintage';
  format?: 'square' | 'landscape' | 'portrait' | 'story' | 'banner';
  quality?: 'standard' | 'high' | 'ultra';
  quantity?: number;
}

export interface VideoGenerationRequest extends GenerationRequest {
  type: 'video';
  prompt: string;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  style?: 'realistic' | 'animated' | 'cinematic' | 'documentary';
  quality?: 'standard' | 'high' | 'ultra';
}

export interface ImageToVideoRequest extends GenerationRequest {
  type: 'video';
  imageUrl: string;
  prompt?: string;
  duration?: number;
  motion?: 'slow' | 'medium' | 'fast';
  camera?: 'static' | 'pan' | 'zoom' | 'tracking';
}

export interface VideoToVideoRequest extends GenerationRequest {
  type: 'video';
  sourceVideoUrl: string;
  prompt: string;
  styleTransfer?: 'cinematic' | 'anime' | 'cartoon' | 'vintage';
  enhanceQuality?: boolean;
}

export interface GeneratedContent {
  id: string;
  type: 'text' | 'image' | 'video';
  url?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
