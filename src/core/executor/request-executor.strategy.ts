
export interface IRequestExecutor<TArgs extends unknown[], TResult> {
  execute(fn: (...args: TArgs) => Promise<TResult>, ...args: TArgs): Promise<TResult>;
}
