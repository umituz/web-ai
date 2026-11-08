
interface QueuedRequest<T> {
  readonly id: string;
  readonly priority: number;
  readonly requestFn: () => Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
  readonly timestamp: number;
}

export interface QueueOptions {
  readonly maxConcurrent?: number;
  readonly defaultPriority?: number;
  readonly requestTimeout?: number;
}

const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_PRIORITY = 0;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export class RequestQueue {
  private queue: QueuedRequest<unknown>[] = [];
  private readonly activeRequests = new Set<string>();
  private readonly maxConcurrent: number;
  private readonly defaultPriority: number;
  private readonly requestTimeout: number;
  private requestIdCounter = 0;

  constructor(options: QueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.defaultPriority = options.defaultPriority ?? DEFAULT_PRIORITY;
    this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  add<T>(requestFn: () => Promise<T>, priority?: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req-${++this.requestIdCounter}`;
      const queuedRequest: QueuedRequest<T> = {
        id,
        priority: priority ?? this.defaultPriority,
        requestFn,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
      };

      this.queue.push(queuedRequest as QueuedRequest<unknown>);
      this.sortQueue();
      this.process();
    });
  }

  cancelAll(): void {
    for (const request of this.queue) {
      request.reject(new Error("Request was cancelled"));
    }
    this.queue = [];
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  private process(): void {
    while (this.queue.length > 0 && this.activeRequests.size < this.maxConcurrent) {
      const request = this.queue.shift();
      if (!request) break;
      this.executeRequest(request);
    }
  }

  private executeRequest<T>(request: QueuedRequest<T>): void {
    this.activeRequests.add(request.id);

    const timeoutId = setTimeout(() => {
      this.activeRequests.delete(request.id);
      request.reject(new Error(`Request ${request.id} timed out`));
      this.process();
    }, this.requestTimeout);

    request.requestFn()
      .then((result) => {
        clearTimeout(timeoutId);
        request.resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        request.reject(error);
      })
      .finally(() => {
        this.activeRequests.delete(request.id);
        this.process();
      });
  }
}

export const requestQueue = new RequestQueue();
