
export const MESSAGE_ID_PREFIX = "msg-" as const;
export const CHAT_MESSAGE_ID_SUFFIX_LENGTH = 9;
export const CACHE_KEY_TYPE_COMPLETION = "completion" as const;
export const CACHE_KEY_TYPE_CHAT = "chat" as const;
export const CACHE_KEY_TYPE_RESPONSE = "response" as const;
export const SYSTEM_PROMPT_CACHE_PREFIX = "system-prompt" as const;

export const USER_ROLE = "user" as const;
export const ASSISTANT_ROLE = "assistant" as const;
export const SYSTEM_ROLE = "system" as const;

export const QUEUE_PRIORITY_USER_REQUEST = 10;
export const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_INITIAL_DELAY_MS = 1000;
export const DEFAULT_RETRY_MAX_DELAY_MS = 10000;
export const DEFAULT_RETRY_BACKOFF_MULTIPLIER = 2;
export const DEFAULT_RETRY_JITTER_FACTOR = 0.1;
