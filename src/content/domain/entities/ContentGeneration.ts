import { SocialPlatform, ContentTone, ContentType } from '../types';

export interface BlogGenerationRequest {
  topic: string;
  blogType: 'tutorial' | 'listicle' | 'review' | 'opinion' | 'howto';
  targetKeywords: string[];
  tone: ContentTone;
  wordCount: number;
  targetAudience: string;
  seoOptimization: boolean;
  includeImages: boolean;
  includeSchema: boolean;
  language?: string;
}

export interface GeneratedBlog {
  id: string;
  title: string;
  content: string;
  metaDescription: string;
  blogType: string;
  tone: string;
  wordCount: number;
  createdAt: string;
  seoScore: number;
  readabilityScore: number;
  keywords: string[];
  performance: {
    readingTime: number;
    shareability: number;
    seoRank: number;
  };
  schemaMarkup?: string;
  imagePrompts?: string[];
}

export interface SocialContentRequest {
  topic: string;
  platform: SocialPlatform;
  tone: ContentTone;
  hashtags?: boolean;
  maxLength?: number;
  targetAudience?: string;
  includeCallToAction?: boolean;
}

export interface GeneratedSocialContent {
  content: string;
  platform: SocialPlatform;
  hashtags: string[];
  emojis: string[];
  characterCount: number;
  estimatedEngagement: number;
}

export interface VideoScriptRequest {
  topic: string;
  tone: ContentTone;
  duration: number;
  targetAudience: string;
  includeVisuals: boolean;
  includeCallToAction: boolean;
}

export interface GeneratedVideoScript {
  script: string;
  visualCues: string[];
  duration: number;
  wordCount: number;
  estimatedEngagement: number;
  callToAction?: string;
}

export interface ContentCalendarEntry {
  date: Date;
  topic: string;
  contentType: ContentType;
  platform: SocialPlatform;
  description: string;
  estimatedEngagement: number;
  priority: 'high' | 'medium' | 'low';
}
