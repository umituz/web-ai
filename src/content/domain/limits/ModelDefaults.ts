
export const ModelDefaults = {
  GROQ_TEXT: 'llama-3.1-8b-instant',
  GROQ_CHAT: 'llama-3.1-8b-instant',
  FAL_IMAGE: 'fal-ai/flux/schnell',
  FAL_VIDEO: 'fal-ai/hunyuan-video/1',
  FAL_IMAGE_TO_VIDEO: 'fal-ai/fast-animatediff/image-to-video',
  GEMINI_TEXT: 'gemini-2.0-flash',
  GEMINI_IMAGE: 'imagen-4.0-generate-001',
  PRUNA_IMAGE: 'p-image',
  PRUNA_IMAGE_EDIT: 'p-image-edit',
  PRUNA_VIDEO: 'p-video',
} as const;

export const TextModelDefaults = {
  TEXT_MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 4_096,
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_TOP_P: 0.9,
} as const;
