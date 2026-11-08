
export const ValidationLimits = {
  TOPIC: {
    MIN: 1,
    MAX: 500,
  },
  CONTENT: {
    MIN: 1,
    MAX: 10_000,
  },
  KEYWORD: {
    MAX_COUNT: 20,
    MAX_LENGTH: 50,
  },
  DURATION_SECONDS: {
    MIN: 10,
    MAX: 600,
  },
  CALENDAR_DAYS: {
    MIN: 1,
    MAX: 90,
  },
  HASHTAG_COUNT: {
    MIN: 1,
    MAX: 50,
  },
  SEO_CONTENT_PREVIEW: 500,
  BLOG_PROMPT_PREVIEW: 1_000,
  AB_VARIANT_CONTENT_PREVIEW: 200,
} as const;

export type ValidationLimitsConfig = typeof ValidationLimits;
