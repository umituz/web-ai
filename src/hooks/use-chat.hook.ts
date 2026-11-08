
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatConfig, ChatMessage } from '../chat/entities';
import type { UseChatOptions, UseChatReturn } from '../chat/interfaces';
import type { ChatService } from '../chat/services/chat.service';
import { chatIdGenerator } from '../chat/utils/chat-id-generator';
import { resolveUserFriendlyMessage } from '../core/errors';
import { isMeaningfulMessageContent, trimMessageContent } from '../chat/validators/message-content-validator';

export interface UseChatDeps {
  readonly chatService: ChatService;
}

export function useChat(options: UseChatOptions, deps?: UseChatDeps): UseChatReturn {
  const chatService = deps?.chatService;
  if (!chatService) {
    throw new Error(
      "useChat requires a ChatService dependency. " +
        "Provide it via the second argument or wire it through the app container.",
    );
  }

  const {
    conversationId,
    storage,
    config,
    autoSave = true,
    stream: streamEnabled = false,
    onMessageSent,
    onAIResponse,
    onError,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageRef = useRef(storage);
  storageRef.current = storage;
  const callbacksRef = useRef({ onMessageSent, onAIResponse, onError });
  callbacksRef.current = { onMessageSent, onAIResponse, onError };

  const abortControllerRef = useRef<AbortController | null>(null);

  const surfaceError = useCallback((err: unknown) => {
    const message = resolveUserFriendlyMessage(err);
    setError(message);
    callbacksRef.current.onError?.(message);
  }, []);

  useEffect(() => {
    if (config) {
      chatService.initialize(config);
    }
  }, [chatService, config]);

  useEffect(() => {
    const currentStorage = storageRef.current;
    if (!currentStorage) return;

    let cancelled = false;
    (async () => {
      try {
        const loaded = await currentStorage.getMessages(conversationId);
        if (!cancelled) {
          setMessages(loaded);
        }
      } catch (err) {
        if (!cancelled) {
          surfaceError(err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, surfaceError]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const persist = useCallback(
    async (message: ChatMessage) => {
      const currentStorage = storageRef.current;
      if (!autoSave || !currentStorage) return;
      try {
        await currentStorage.saveMessage(conversationId, message);
      } catch (err) {
        surfaceError(err);
      }
    },
    [autoSave, conversationId, surfaceError],
  );

  const sendMessage = useCallback(
    async (text: string, type?: ChatMessage["type"]): Promise<ChatMessage | null> => {
      const trimmed = trimMessageContent(text);
      if (!isMeaningfulMessageContent(trimmed)) return null;
      if (isLoading) return null;

      const controller = new AbortController();
      abortControllerRef.current?.abort();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);
      setIsTyping(true);

      const userMessage: ChatMessage = {
        id: chatIdGenerator.next("user"),
        sender: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
        type: type ?? "text",
      };

      let contextForAI: ReadonlyArray<ChatMessage> = [];
      setMessages((prev) => {
        contextForAI = prev;
        return [...prev, userMessage];
      });
      void persist(userMessage);
      callbacksRef.current.onMessageSent?.(userMessage);

      let streamingPlaceholderId: string | null = null;
      try {
        if (streamEnabled) {
          const placeholderId = chatIdGenerator.next("assistant");
          streamingPlaceholderId = placeholderId;
          const placeholder: ChatMessage = {
            id: placeholderId,
            sender: "assistant",
            content: "",
            timestamp: new Date().toISOString(),
            type: "text",
            metadata: { streaming: true },
          };
          setMessages((prev) => [...prev, placeholder]);

          const fullText = await chatService.generateStreamingResponse(
            trimmed,
            contextForAI,
            (chunk) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId
                    ? { ...m, content: m.content + chunk }
                    : m,
                ),
              );
            },
            controller.signal,
          );

          const finalMessage: ChatMessage = {
            ...placeholder,
            content: fullText,
            metadata: { ...placeholder.metadata, streaming: false },
          };
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? finalMessage : m)),
          );
          void persist(finalMessage);
          callbacksRef.current.onAIResponse?.(finalMessage);
          return finalMessage;
        }

        const aiResponse = await chatService.generateAIResponse(
          conversationId,
          trimmed,
          contextForAI,
          controller.signal,
        );

        setMessages((prev) => [...prev, aiResponse]);
        void persist(aiResponse);
        callbacksRef.current.onAIResponse?.(aiResponse);
        return aiResponse;
      } catch (err) {
        if (streamingPlaceholderId) {
          const failedId = streamingPlaceholderId;
          setMessages((prev) => prev.filter((m) => m.id !== failedId));
        }
        surfaceError(err);
        return null;
      } finally {
        setIsLoading(false);
        setIsTyping(false);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [chatService, conversationId, isLoading, persist, streamEnabled, surfaceError],
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setIsTyping(false);
  }, []);

  const regenerate = useCallback(async (): Promise<ChatMessage | null> => {
    if (isLoading) return null;

    const currentMessages = messages;
    if (currentMessages.length === 0) return null;

    const lastUserMessage = [...currentMessages]
      .reverse()
      .find((m) => m.sender === "user");
    if (!lastUserMessage) return null;

    const trimmed =
      currentMessages.length > 0 &&
      currentMessages[currentMessages.length - 1].sender === "assistant"
        ? currentMessages.slice(0, -1)
        : currentMessages;

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    setIsTyping(true);

    try {
      const aiResponse = await chatService.generateAIResponse(
        conversationId,
        lastUserMessage.content,
        trimmed,
        controller.signal,
      );

      setMessages((prev) => {
        const lastIsAI =
          prev.length > 0 && prev[prev.length - 1].sender === "assistant";
        const base = lastIsAI ? prev.slice(0, -1) : prev;
        return [...base, aiResponse];
      });

      void persist(aiResponse);
      callbacksRef.current.onAIResponse?.(aiResponse);
      return aiResponse;
    } catch (err) {
      surfaceError(err);
      return null;
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [chatService, conversationId, isLoading, messages, persist, surfaceError]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    cancel();
    setError(null);
  }, [cancel]);

  const updateConfig = useCallback(
    (newConfig: Partial<ChatConfig>) => {
      chatService.updateConfig(newConfig);
    },
    [chatService],
  );

  return {
    messages,
    isLoading,
    isTyping,
    error,
    sendMessage,
    regenerate,
    cancel,
    clearMessages,
    clearError,
    reset,
    updateConfig,
  };
}
