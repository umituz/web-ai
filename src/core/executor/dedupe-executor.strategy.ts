
import type { IRequestExecutor } from "./request-executor.strategy";
import type { RequestDeduplicator } from "../utils/request-deduplicator.util";

export type KeyGenerator<TArgs extends unknown[]> = (...args: TArgs) => string;

export interface DedupeExecutorOptions<TArgs extends unknown[]> {
  readonly generateKey: KeyGenerator<TArgs>;
}

export class DedupeExecutor<TArgs extends unknown[], TResult>
  implements IRequestExecutor<TArgs, TResult>
{
  constructor(
    private readonly deduplicator: RequestDeduplicator,
    private readonly options: DedupeExecutorOptions<TArgs>,
  ) {}

  execute(fn: (...args: TArgs) => Promise<TResult>, ...args: TArgs): Promise<TResult> {
    const key = this.options.generateKey(...args);
    return this.deduplicator.execute(key, () => fn(...args));
  }
}
