
import type { IRequestExecutor } from "./request-executor.strategy";
import { RetryManager, RetryOptions } from "../utils/retry";

export class RetryExecutor<TArgs extends unknown[], TResult>
  implements IRequestExecutor<TArgs, TResult>
{
  constructor(
    private readonly retryManager: RetryManager,
    private readonly options?: RetryOptions,
  ) {}

  execute(fn: (...args: TArgs) => Promise<TResult>, ...args: TArgs): Promise<TResult> {
    return this.retryManager.execute(() => fn(...args), this.options);
  }
}
