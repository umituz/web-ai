
import type {
  ChatMessage,
  ChatConversation,
  SendMessageInput,
  SendMessageResult,
  ChatConfig,
  IChatStorage,
} from "../entities";
import type { ChatMessage as CoreChatMessage } from "../../core/types";
import type { SystemPromptStrategy } from "../utils/prompt-strategy";

export interface IChatService {
  sendMessage(input: SendMessageInput, signal?: AbortSignal): Promise<SendMessageResult>;
  getConversation(conversationId: string): Promise<ChatConversation | null>;
  getConversations(): Promise<ChatConversation[]>;
  generateAIResponse(
    companionId: string,
    userMessage: string,
    context?: ReadonlyArray<ChatMessage>,
    signal?: AbortSignal,
  ): Promise<ChatMessage>;
  generateStreamingResponse(
    userMessage: string,
    context: ReadonlyArray<ChatMessage>,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string>;
}

export interface UseChatOptions {
  readonly conversationId: string;
  readonly storage?: IChatStorage;
  readonly config?: ChatConfig;
  readonly autoSave?: boolean;
  readonly stream?: boolean;
  readonly onMessageSent?: (message: ChatMessage) => void;
  readonly onAIResponse?: (message: ChatMessage) => void;
  readonly onError?: (error: string) => void;
}

export interface UseChatReturn {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly isLoading: boolean;
  readonly isTyping: boolean;
  readonly error: string | null;
  sendMessage: (
    text: string,
    type?: ChatMessage["type"],
  ) => Promise<ChatMessage | null>;
  regenerate: () => Promise<ChatMessage | null>;
  cancel: () => void;
  clearMessages: () => void;
  clearError: () => void;
  reset: () => void;
  updateConfig: (config: Partial<ChatConfig>) => void;
}

export interface IMessageFormatter {
  toCoreMessages(messages: ReadonlyArray<ChatMessage>): CoreChatMessage[];
  toChatMessage(content: string, sender: ChatMessage["sender"]): ChatMessage;
}

export type { SystemPromptStrategy };
