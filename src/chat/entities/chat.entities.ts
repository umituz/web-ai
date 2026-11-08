
import type { TextTier } from "../../core/types";

export type ChatMessageSender = "user" | "assistant" | "system";

export type ChatMessageType = "text" | "image" | "audio" | "sticker";

export interface ChatMessage {
  readonly id: string;
  readonly sender: ChatMessageSender;
  readonly content: string;
  readonly timestamp: string;
  readonly type?: ChatMessageType;
  readonly imageUrl?: string;
  readonly reaction?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatConversation {
  readonly id: string;
  readonly companionId: string;
  readonly companionName: string;
  readonly lastMessage?: ChatMessage;
  readonly messageCount: number;
  readonly updatedAt: string;
}

export interface SendMessageInput {
  readonly companionId: string;
  readonly text: string;
  readonly type?: ChatMessageType;
  readonly imageUrl?: string;
}

export interface SendMessageResult {
  readonly userMessage: ChatMessage;
  readonly aiResponse?: ChatMessage;
}

export interface ChatConfig {
  readonly systemPrompt?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Neutral quality tier — resolved against whichever provider serves the chat. */
  readonly tier?: TextTier;
  /** Explicit model id; wins over tier resolution. */
  readonly model?: string;
}

export interface IChatStorage {
  saveMessage(conversationId: string, message: ChatMessage): Promise<void>;
  getMessages(conversationId: string): Promise<ChatMessage[]>;
  updateMessage(messageId: string, updates: Partial<ChatMessage>): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
}

export interface ChatTokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}
