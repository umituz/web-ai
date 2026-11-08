import { ContentType, ContentTone } from '../types';

export interface ABTestVariant {
  id: string;
  name?: string;
  content: string;
  contentType: ContentType;
  tone: ContentTone;
}

export interface ABTestPrediction {
  variantId: string;
  predictedEngagement: number;
  predictedCTR: number;
  predictedConversions: number;
  confidence: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface ABTestComparison {
  winner: string;
  confidence: number;
  improvement: string;
  reasoning: string;
  recommendations: string[];
}

export interface ABTestRequest {
  variants: ABTestVariant[];
  targetAudience: string;
  platform: string;
  goals: string[];
}
