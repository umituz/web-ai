/**
 * useRemoteChat — streaming chat state machine over a backend proxy.
 *
 * Owns the message-list state a chat UI needs while a remote SSE stream is
 * running: optimistic user echo, a streaming assistant placeholder, delta
 * appends (answer + reasoning channels), usage/error/done patches, tool
 * approval continuation, and abort tracking. The transport comes from
 * `createRemoteChatClient`; side effects (refetching collections, thread
 * refresh) hang off `onStreamEnd`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  RemoteChatClient,
  RemoteChatStreamBody,
  RemoteStreamHandle,
} from "../core/remote/remote-chat-client";
import type { StreamCallbacks } from "../core/sse/browser-sse-reader";

export type RemoteChatMessageStatus = "pending" | "streaming" | "complete" | "stopped" | "error";

export interface RemoteChatUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens?: number;
}

export interface RemoteChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly reasoning: string;
  readonly status: RemoteChatMessageStatus;
  readonly error: { readonly code: string; readonly message: string } | null;
  readonly usage: RemoteChatUsage | null;
}

/** Placeholder id for the assistant message while it streams; replaced by
 *  the persisted id on `done`. */
export const REMOTE_CHAT_STREAMING_ID = "streaming";

export interface UseRemoteChatOptions<TToolCall = unknown> {
  readonly client: RemoteChatClient;
  /** Called for every `tool_call` event (pending approval, etc.). */
  readonly onToolCall?: (toolCall: TToolCall) => void;
  /** Called once per finished stream (success, error, or abort). */
  readonly onStreamEnd?: (info: {
    readonly conversationId: string;
    readonly stopped: boolean;
  }) => void | Promise<void>;
  /** Id factory for the optimistic user echo. */
  readonly localUserId?: () => string;
  /**
   * `replace` (default) mounts each turn on a fresh list — the hook owns
   * the whole message array. `append` keeps the existing messages (loaded
   * history) and appends the new turn, so a drawer can stream into a
   * conversation it already shows without refetching mid-turn.
   */
  readonly turnMode?: "replace" | "append";
}

export interface UseRemoteChatReturn {
  readonly messages: ReadonlyArray<RemoteChatMessage>;
  setMessages: Dispatch<SetStateAction<RemoteChatMessage[]>>;
  readonly isStreaming: boolean;
  readonly isResolving: boolean;
  /** Start a stream; `localUserContent` echoes the user message optimistically. */
  stream(
    conversationId: string,
    body: RemoteChatStreamBody,
    opts?: { readonly localUserContent?: string },
  ): Promise<void>;
  /** Approve/reject a tool call and consume the continuation stream. */
  resolveToolCall(conversationId: string, toolCallId: string, approved: boolean): Promise<boolean>;
  /** Abort the active stream; the next `onStreamEnd` reports `stopped: true`. */
  abort(): void;
  /** Patch the last message (status/id/usage updates). */
  patchLast(patch: Partial<RemoteChatMessage>): void;
}

function placeholder(id: string, status: RemoteChatMessageStatus): RemoteChatMessage {
  return { id, role: "assistant", content: "", reasoning: "", status, error: null, usage: null };
}

export function useRemoteChat<TToolCall = unknown>(
  options: UseRemoteChatOptions<TToolCall>,
): UseRemoteChatReturn {
  const { client } = options;

  const [messages, setMessages] = useState<RemoteChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const handleRef = useRef<RemoteStreamHandle | null>(null);
  const stoppedRef = useRef(false);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const patchLast = useCallback((patch: Partial<RemoteChatMessage>) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last) return prev;
      next[next.length - 1] = { ...last, ...patch };
      return next;
    });
  }, []);

  const appendDelta = useCallback((channel: "answer" | "reasoning", text: string) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last) return prev;
      next[next.length - 1] =
        channel === "reasoning"
          ? { ...last, reasoning: last.reasoning + text }
          : { ...last, content: last.content + text };
      return next;
    });
  }, []);

  const callbacks = useCallback(
    (): StreamCallbacks<TToolCall> => ({
      onDelta: appendDelta,
      onUsage: (usage) => patchLast({ usage }),
      onError: (code, message) => patchLast({ status: "error", error: { code, message } }),
      onDone: (messageId) => patchLast({ id: messageId, status: "complete" }),
      onToolCall: (toolCall) => optionsRef.current.onToolCall?.(toolCall),
    }),
    [appendDelta, patchLast],
  );

  const stream = useCallback(
    async (
      conversationId: string,
      body: RemoteChatStreamBody,
      opts?: { readonly localUserContent?: string },
    ): Promise<void> => {
      setIsStreaming(true);
      stoppedRef.current = false;
      const turn: RemoteChatMessage[] = [
        ...(opts?.localUserContent !== undefined
          ? [
              {
                id: optionsRef.current.localUserId?.() ?? `local-${Date.now()}`,
                role: "user" as const,
                content: opts.localUserContent,
                reasoning: "",
                status: "complete" as const,
                error: null,
                usage: null,
              },
            ]
          : []),
        placeholder(REMOTE_CHAT_STREAMING_ID, "streaming"),
      ];
      setMessages((prev) =>
        optionsRef.current.turnMode === "append" ? [...prev, ...turn] : turn,
      );

      const handle = client.streamChat(conversationId, body, callbacks());
      handleRef.current = handle;
      try {
        await handle.promise.catch(() => undefined);
      } finally {
        handleRef.current = null;
        setIsStreaming(false);
        await optionsRef.current.onStreamEnd?.({
          conversationId,
          stopped: stoppedRef.current,
        });
        stoppedRef.current = false;
      }
    },
    [callbacks, client],
  );

  const resolveToolCall = useCallback(
    async (conversationId: string, toolCallId: string, approved: boolean): Promise<boolean> => {
      setIsResolving(true);
      setIsStreaming(true);
      stoppedRef.current = false;
      setMessages((prev) => [...prev, placeholder(REMOTE_CHAT_STREAMING_ID, "streaming")]);

      try {
        return await client.resolveToolCall(conversationId, toolCallId, approved, callbacks());
      } catch {
        return false;
      } finally {
        setIsStreaming(false);
        setIsResolving(false);
        await optionsRef.current.onStreamEnd?.({
          conversationId,
          stopped: stoppedRef.current,
        });
        stoppedRef.current = false;
      }
    },
    [callbacks, client],
  );

  const abort = useCallback(() => {
    stoppedRef.current = true;
    handleRef.current?.abort();
  }, []);

  return {
    messages,
    setMessages,
    isStreaming,
    isResolving,
    stream,
    resolveToolCall,
    abort,
    patchLast,
  };
}
