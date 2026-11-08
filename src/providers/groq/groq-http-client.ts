
import type { GroqChatRequest, GroqChatResponse, GroqProviderConfig, StreamRequestOptions } from "./groq.entities";
import type { IRequestExecutor } from "../../core/executor";
import { GroqHttpTransport } from "./groq-http-transport";
import { RequestDeduplicator } from "../../core/utils";
import { RequestQueue } from "../../core/utils";
import { RetryManager } from "../../core/utils";
import {
  CompositeExecutor,
  DedupeExecutor,
  QueueExecutor,
  RetryExecutor,
} from "../../core/executor";
import { QUEUE_PRIORITY_USER_REQUEST } from "../../core/constants/identifier.constants";

export interface GroqHttpClientDeps {
  readonly transport?: GroqHttpTransport;
  readonly retryManager?: RetryManager;
  readonly queue?: RequestQueue;
  readonly deduplicator?: RequestDeduplicator;
}

/**
 * Groq HTTP client with the ported strategy stack: identical concurrent
 * requests are deduplicated, transient failures retried with backoff, and
 * everything is funneled through a priority queue. Composition root for
 * GroqProvider — no global state.
 */
export class GroqHttpClient {
  private readonly transport: GroqHttpTransport;
  private readonly executor: IRequestExecutor<[GroqChatRequest], GroqChatResponse>;

  constructor(config: GroqProviderConfig, deps: GroqHttpClientDeps = {}) {
    this.transport = deps.transport ?? new GroqHttpTransport(config);

    const retryManager = deps.retryManager ?? new RetryManager();
    const queue = deps.queue ?? new RequestQueue();
    const deduplicator = deps.deduplicator ?? new RequestDeduplicator();

    this.executor = new CompositeExecutor<[GroqChatRequest], GroqChatResponse>([
      new DedupeExecutor<[GroqChatRequest], GroqChatResponse>(deduplicator, {
        generateKey: (request) =>
          deduplicatorKey(request, config.apiKey),
      }),
      new RetryExecutor<[GroqChatRequest], GroqChatResponse>(retryManager),
      new QueueExecutor<[GroqChatRequest], GroqChatResponse>(queue, QUEUE_PRIORITY_USER_REQUEST),
    ]);
  }

  cancelPendingRequests(): void {
    this.transport.cancelPendingRequests();
  }

  postChatCompletion(request: GroqChatRequest): Promise<GroqChatResponse> {
    return this.executor.execute(
      (req) => this.transport.postChatCompletion(req),
      request,
    );
  }

  streamChatCompletion(
    request: GroqChatRequest,
    options?: StreamRequestOptions,
  ): Promise<ReadableStream<Uint8Array>> {
    return this.transport.streamChatCompletion(request, options);
  }
}

function deduplicatorKey(request: GroqChatRequest, apiKey: string): string {
  const { model, messages, stream: _stream, ...rest } = request;
  const stable = JSON.stringify({
    apiKey,
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    ...rest,
  });
  return stable;
}
