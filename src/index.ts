/**
 * @umituz/web-ai — root entry, React-free and Workers-safe.
 *
 * Compose with createAI(), then chat/stream/generate media through the
 * provider-neutral factory. Swapping Groq ↔ Claude ↔ Gemini is a config
 * change, not a code change.
 *
 * React hooks live in `@umituz/web-ai/hooks`, content services in
 * `./content`, wizards in `./wizard`. The chat entry re-exports its
 * conversation message type as `ChatMessage`; here it is aliased to
 * `ConversationMessage` because core already owns the wire-level
 * `ChatMessage {role, content}`.
 */

export * from './core';
export * from './providers';

export type {
  ChatMessageSender,
  ChatMessageType,
  ChatConversation,
  SendMessageInput,
  SendMessageResult,
  ChatConfig,
  IChatStorage,
  ChatTokenUsage,
} from './chat';
export type {
  IChatService,
  UseChatOptions,
  UseChatReturn,
  IMessageFormatter,
  SystemPromptStrategy,
} from './chat';
export type { ChatMessage as ConversationMessage } from './chat';
export { ChatService, messageFormatter, extractTokenUsage } from './chat';
export { chatIdGenerator, ChatIdGenerator, DEFAULT_PROMPT_STRATEGY } from './chat';
