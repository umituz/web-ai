
import { estimateWordCountForDuration, estimateTokenBudgetForDuration } from '../../domain/calculations/SpeechPaceEstimate';

export class PromptBuilder {
  static blogPost(input: {
    topic: string;
    blogType: string;
    keywords: string[];
    tone: string;
    targetAudience: string;
    wordCount: number;
    language?: string;
    seoOptimization: boolean;
    includeSchema: boolean;
    includeImages: boolean;
  }): string {
    return `
As an expert SEO Content Strategist and Copywriter, generate a high-quality, comprehensive blog post.

TOPIC: ${input.topic}
TYPE: ${input.blogType}
KEYWORDS: ${input.keywords.join(', ')}
TONE: ${input.tone}
TARGET AUDIENCE: ${input.targetAudience}
WORD COUNT: ${input.wordCount}
LANGUAGE: ${input.language || 'English'}

OPTIMIZATION REQUIREMENTS:
- SEO Optimization: ${input.seoOptimization ? 'ON (Include semantic keywords, LSI, and proper H1-H3 structure)' : 'OFF'}
- Include Schema Markup: ${input.includeSchema ? 'ON (Generate JSON-LD for this blog type)' : 'OFF'}
- Image Suggestions: ${input.includeImages ? 'ON (Provide DALL-E/Midjourney style prompts for contextually relevant images)' : 'OFF'}

RESPONSE FORMAT (STRICT JSON ONLY):
{
  "title": "Compelling, Click-worthy Title",
  "content": "Full markdown-formatted blog content with headers",
  "metaDescription": "SEO-optimized description (150-160 chars)",
  "seoScore": 0-100,
  "readabilityScore": 0-100,
  "keywords": ["list", "of", "optimized", "keywords"],
  "performance": {
    "readingTime": minutes (number),
    "shareability": 0-10 (number),
    "seoRank": 0-10 (number)
  },
  "schemaMarkup": "JSON-LD string (if requested)",
  "imagePrompts": ["Prompt 1", "Prompt 2"] (if requested)
}
`;
  }

  static socialPost(input: {
    topic: string;
    platform: string;
    tone: string;
    style: string;
    maxLength: number;
    includeHashtags: boolean;
    includeCallToAction: boolean;
  }): string {
    return `
Write a ${input.tone} social media post about: ${input.topic}

Platform: ${input.platform}
Style: ${input.style}
Maximum length: ${input.maxLength} characters
${input.includeHashtags ? 'Include relevant hashtags' : 'No hashtags'}
${input.includeCallToAction ? 'Include a call-to-action' : ''}

Requirements:
- Platform-optimized formatting
- Engaging hook in first sentence
- Natural, conversational tone
- Platform-appropriate emoji usage

Generate the post in JSON format:
{
  "content": "The post content",
  "hashtags": ["hashtag1", "hashtag2"],
  "emojis": ["emoji1", "emoji2"],
  "estimatedEngagement": 0-100
}
`;
  }

  static videoScript(input: {
    topic: string;
    tone: string;
    duration: number;
    targetAudience: string;
    includeVisuals: boolean;
    includeCallToAction: boolean;
  }): string {
    return `
Create a ${input.tone} video script about: ${input.topic}

Duration: ${input.duration} seconds
Target Audience: ${input.targetAudience}
Include Visual Cues: ${input.includeVisuals ? 'Yes' : 'No'}
Include CTA: ${input.includeCallToAction ? 'Yes' : 'No'}

Approximate word count: ${estimateWordCountForDuration(input.duration)} words

Generate in JSON format:
{
  "script": "Full script with dialogue and narration",
  "visualCues": ["Visual cue 1", "Visual cue 2"],
  "callToAction": "Call to action text (if requested)",
  "estimatedEngagement": 0-100
}
`;
  }

  static voiceScript(input: {
    topic: string;
    emotion: string;
    duration: number;
  }): string {
    return `
Create a ${input.emotion} voice script about: ${input.topic}

Duration: ${input.duration} seconds
Emotion: ${input.emotion}

The script should:
- Evoke the specified emotion
- Be suitable for voice recording with emotion control
- Include natural speech patterns
- Have appropriate pacing for the emotion
- Include emotional cues in brackets where needed

Approximate word count: ${estimateWordCountForDuration(input.duration)} words

Generate in JSON format:
{
  "script": "Full script with emotional cues",
  "visualCues": ["Visual cue 1", "Visual cue 2"],
  "estimatedEngagement": 0-100
}
`;
  }

  static contentCalendar(niche: string, days: number): string {
    return `
Generate a ${days}-day content calendar for: ${niche}

For each day, provide:
- Topic
- Content type (blog, video, social, email, caption, script)
- Best platform for this content
- Brief description
- Estimated engagement (0-100)
- Priority level (high, medium, low)

Format as JSON array:
[
  {
    "day": 1,
    "topic": "...",
    "contentType": "blog|video|social|email|caption|script",
    "platform": "twitter|linkedin|instagram|threads|tiktok|facebook",
    "description": "...",
    "estimatedEngagement": 0-100,
    "priority": "high|medium|low"
  }
]

Requirements:
- Mix of content types across platforms
- Platform-appropriate suggestions
- Engaging, varied topics
- Realistic posting schedule
`;
  }

  static sentiment(content: string): string {
    return `
Analyze the sentiment of this social media post:

"${content}"

Provide analysis in JSON format:
{
  "sentiment": "positive|neutral|negative",
  "confidence": 0-1,
  "emotions": [
    {"emotion": "happy|excited|calm|sad|angry|surprised|fearful|disgusted|neutral", "score": 0-1}
  ]
}

Return only the JSON:
`;
  }

  static contentAnalysis(content: string): string {
    return `
Analyze this content:

"${content}"

Provide analysis in JSON format:
{
  "keywords": ["keyword1", "keyword2", ...],
  "entities": ["entity1", "entity2", ...],
  "suggestedImprovements": ["suggestion1", ...],
  "readabilityScore": 0-100,
  "estimatedEngagement": 0-100
}

Return only the JSON:
`;
  }

  static seoOptimization(content: string, keywords: string[]): string {
    return `
Optimize this content for SEO:

Content: "${content}"
Keywords: ${keywords.join(', ')}

Tasks:
1. Incorporate keywords naturally
2. Improve engagement potential
3. Add relevant call-to-action if appropriate
4. Optimize for readability
5. Enhance heading structure

Return JSON:
{
  "optimized": "...",
  "score": 0-100,
  "suggestions": ["suggestion1", ...],
  "addedKeywords": ["keyword1", ...],
  "removedFillerWords": number,
  "readabilityImprovements": ["improvement1", ...],
  "metaDescription": "SEO-optimized meta description",
  "titleSuggestions": ["title1", ...]
}

Return only the JSON:
`;
  }

  static seoScore(content: string, keywords: string[]): string {
    return `
Calculate SEO score for this content:

Content: "${content}"
Keywords: ${keywords.join(', ')}

Provide breakdown in JSON:
{
  "keywordDensity": 0-100,
  "readabilityScore": 0-100,
  "titleOptimization": 0-100,
  "metaDescription": 0-100,
  "headingStructure": 0-100,
  "internalLinking": 0-100,
  "overall": 0-100
}

Return only the JSON:
`;
  }

  static abTestVariant(input: {
    content: string;
    contentType: string;
    tone: string;
    targetAudience: string;
    platform: string;
    goals: string[];
  }): string {
    return `
Predict performance for this content variant:

Content: "${input.content}"
Content Type: ${input.contentType}
Tone: ${input.tone}
Target Audience: ${input.targetAudience}
Platform: ${input.platform}
Goals: ${input.goals.join(', ')}

Provide prediction in JSON:
{
  "predictedEngagement": 0-100,
  "predictedCTR": 0-100,
  "predictedConversions": 0-100,
  "confidence": 0-1,
  "reasoning": "...",
  "strengths": ["strength1", ...],
  "weaknesses": ["weakness1", ...],
  "suggestions": ["suggestion1", ...]
}

Return only the JSON:
`;
  }

  static hashtags(content: string, count: number): string {
    return `
Generate ${count} relevant hashtags for this content:

"${content}"

Requirements:
- Mix of popular and niche hashtags
- Industry-specific when possible
- Trending if relevant
- No duplicated words
- Format: #hashtag (one per line)

Return only the hashtags:
`;
  }

  static imagePrompt(description: string, style: string): string {
    return `
Generate a detailed AI image generation prompt for:

Description: ${description}
Style: ${style || 'realistic'}

Create a detailed, descriptive prompt that includes:
- Subject details
- Mood and atmosphere
- Lighting
- Composition
- Art style reference
- Technical specifications (aspect ratio, quality)

The prompt should be optimized for models like Midjourney, DALL-E, or Stable Diffusion.

Generate the prompt:
`;
  }

  static blogImagePrompts(blogContent: string): string {
    return `
Analyze this blog content and generate 3-5 detailed image prompts for illustrative images:

Blog Content: "${blogContent}"

For each image prompt, provide:
- Subject description
- Mood and atmosphere
- Style reference
- Composition details
- Technical specs

Return as JSON array:
["prompt1", "prompt2", "prompt3", ...]

Return only the JSON:
`;
  }

  static maxTokensForDuration(durationSeconds: number): number {
    return estimateTokenBudgetForDuration(durationSeconds);
  }
}
