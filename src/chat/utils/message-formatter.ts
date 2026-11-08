
import type { IMessageFormatter } from "../interfaces";
import type { ChatMessage } from "../entities";
import type { ChatMessage as CoreChatMessage } from "../../core/types";
import type { ChatIdGenerator } from "./chat-id-generator";
import { chatIdGenerator as defaultIdGenerator } from "./chat-id-generator";
import { ASSISTANT_ROLE, USER_ROLE } from "../../core/constants/identifier.constants";

export class MessageFormatter implements IMessageFormatter {
  constructor(private readonly idGenerator: ChatIdGenerator = defaultIdGenerator) {}

  /** Maps chat-domain history to neutral core messages; system senders are
   *  dropped — the system prompt travels on the request's own slot. */
  toCoreMessages(messages: ReadonlyArray<ChatMessage>): CoreChatMessage[] {
    const coreMessages: CoreChatMessage[] = [];
    for (const message of messages) {
      if (message.sender === "system") continue;
      coreMessages.push({
        role: message.sender === "user" ? USER_ROLE : ASSISTANT_ROLE,
        content: message.content,
      });
    }
    return coreMessages;
  }

  toChatMessage(content: string, sender: ChatMessage["sender"]): ChatMessage {
    return {
      id: this.idGenerator.next(sender),
      sender,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      type: "text",
    };
  }
}

export const messageFormatter = new MessageFormatter();
