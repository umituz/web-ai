
import type { IRequestExecutor } from "./request-executor.strategy";
import { RequestQueue } from "../utils/request-queue.util";

export class QueueExecutor<TArgs extends unknown[], TResult>
  implements IRequestExecutor<TArgs, TResult>
{
  constructor(
    private readonly queue: RequestQueue,
    private readonly priority: number,
  ) {}

  execute(fn: (...args: TArgs) => Promise<TResult>, ...args: TArgs): Promise<TResult> {
    return this.queue.add(() => fn(...args), this.priority);
  }
}
