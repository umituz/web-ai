import type { GroqMessage, GroqMessageRole } from "./groq.entities";

export const createUserMessage = (content: string): GroqMessage => ({
  role: "user",
  content,
});

export const createAssistantMessage = (content: string): GroqMessage => ({
  role: "assistant",
  content,
});

export const createSystemMessage = (content: string): GroqMessage => ({
  role: "system",
  content,
});

export const createMessage = (role: GroqMessageRole, content: string): GroqMessage => ({
  role,
  content,
});

export const promptToMessages = (prompt: string): GroqMessage[] => [
  createUserMessage(prompt),
];

export const extractTextFromMessages = (messages: ReadonlyArray<GroqMessage>): string =>
  messages.map((m) => m.content).join("\n\n");

export const formatMessagesForDisplay = (
  messages: ReadonlyArray<GroqMessage>,
): string =>
  messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n---\n\n");
