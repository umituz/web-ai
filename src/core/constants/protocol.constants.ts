export const SSE_PREFIX = "data: " as const;
export const SSE_DONE_MARKER = "[DONE]" as const;

export const JSON_CODE_BLOCK_PATTERN = /```json\n([\s\S]*?)\n```/;
export const JSON_OBJECT_PATTERN = /\{[\s\S]*\}/;
