import { Sentiment, Emotion } from '../types';

export interface SentimentAnalysisResult {
  sentiment: Sentiment;
  confidence: number;
  emotions: EmotionScore[];
}

export interface EmotionScore {
  emotion: Emotion;
  score: number;
}

export interface ContentAnalysisRequest {
  content: string;
  detectEmotions?: boolean;
  detectKeywords?: boolean;
  detectEntities?: boolean;
}

export interface ContentAnalysisResult {
  sentiment: SentimentAnalysisResult;
  keywords: string[];
  entities: string[];
  suggestedImprovements: string[];
  readabilityScore: number;
  estimatedEngagement: number;
}
