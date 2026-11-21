import type { CSSProperties, ReactNode } from 'react';

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMessageStatus = 'sending' | 'sent' | 'error' | 'streaming';

export interface ChatMessageItem {
  id?: string;
  role: ChatRole;
  content: string;
  reasoning?: string;
  createdAt?: string | Date;
  status?: ChatMessageStatus;
  tokens?: number;
  model?: string;
  error?: string;
}

export interface ReasoningBlockProps {
  reasoning: string;
  streaming?: boolean;
  label?: string;
  thinkingLabel?: string;
  className?: string;
  style?: CSSProperties;
  defaultOpen?: boolean;
}

export interface ToolCallItem {
  id: string;
  toolKey?: string;
  toolName: string;
  args: Record<string, unknown> | string;
  status: 'pending' | 'approved' | 'rejected' | 'succeeded' | 'failed';
  result?: unknown;
  error?: string;
}

export interface ToolCallCardProps {
  toolCall: ToolCallItem;
  onResolve?: (id: string, approved: boolean) => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export interface SuggestedPromptsProps {
  prompts: readonly string[] | string[];
  onSelect: (prompt: string) => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

export interface PromptComposerProps {
  onSend: (content: string) => void | Promise<void>;
  onStop?: () => void;
  loading?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
  maxLength?: number;
}

export interface ChatMessageProps {
  message: ChatMessageItem;
  showAvatar?: boolean;
  avatar?: ReactNode;
  userAvatar?: ReactNode;
  assistantAvatar?: ReactNode;
  onCopy?: (content: string) => void;
  className?: string;
  style?: CSSProperties;
}

export interface ChatPaneProps {
  messages: ChatMessageItem[];
  toolCalls?: ToolCallItem[];
  onResolveToolCall?: (id: string, approved: boolean) => void;
  loading?: boolean;
  isLoading?: boolean;
  streamingMessage?: string;
  onSend: (content: string) => void | Promise<void>;
  onStop?: () => void;
  onClear?: () => void;
  suggestedPrompts?: readonly string[] | string[];
  placeholder?: string;
  title?: string;
  subtitle?: string;
  brandName?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  headerActions?: ReactNode;
  footerNotice?: ReactNode;
  userAvatar?: ReactNode;
  assistantAvatar?: ReactNode;
}

export interface AIAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  position?: 'right' | 'left';
  width?: number | string;
  chatProps: Omit<ChatPaneProps, 'title' | 'subtitle'>;
  className?: string;
  style?: CSSProperties;
}

export interface AIAssistantModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  maxWidth?: number | string;
  chatProps: Omit<ChatPaneProps, 'title' | 'subtitle'>;
  className?: string;
  style?: CSSProperties;
}
