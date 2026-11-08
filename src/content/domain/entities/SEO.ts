export interface SEOOptimizationRequest {
  content: string;
  keywords: string[];
  targetPlatform?: string;
  includeSchemaMarkup?: boolean;
  language?: string;
}

export interface SEOOptimizationResult {
  optimized: string;
  score: number;
  suggestions: string[];
  addedKeywords: string[];
  removedFillerWords: number;
  readabilityImprovements: string[];
  metaDescription?: string;
  titleSuggestions?: string[];
  schemaMarkup?: string;
}

export interface SEOScoreBreakdown {
  keywordDensity: number;
  readabilityScore: number;
  titleOptimization: number;
  metaDescription: number;
  headingStructure: number;
  internalLinking: number;
  overall: number;
}

export interface KeywordAnalysis {
  keyword: string;
  count: number;
  density: number;
  prominence: 'high' | 'medium' | 'low';
  suggestions: string[];
}
