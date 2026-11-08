
import {
  shouldCallOnLeadingEdge,
  calculateTrailingDelay,
} from "../calculations/timing-window";

type TimerHandle = ReturnType<typeof setTimeout>;

export interface DebounceOptions {
  readonly delay?: number;
  readonly leading?: boolean;
  readonly trailing?: boolean;
}

export interface ThrottleOptions {
  readonly interval?: number;
  readonly leading?: boolean;
  readonly trailing?: boolean;
}

const DEFAULT_DEBOUNCE_DELAY_MS = 300;
const DEFAULT_THROTTLE_INTERVAL_MS = 1000;

export class DebounceManager {
  private readonly timers = new Map<string, TimerHandle>();
  private readonly lastArgs = new Map<string, readonly unknown[]>();

  debounce<T extends (...args: never[]) => unknown>(
    fn: T,
    options: DebounceOptions = {},
  ): T {
    const delay = options.delay ?? DEFAULT_DEBOUNCE_DELAY_MS;
    const leading = options.leading ?? false;
    const trailing = options.trailing ?? true;

    let timer: TimerHandle | null = null;
    let lastCallTime = 0;
    let lastResult: unknown;

    return ((...args: never[]) => {
      const now = Date.now();
      const shouldCallLeading = shouldCallOnLeadingEdge({
        now,
        lastCallTime,
        interval: delay,
        leadingEnabled: leading,
        isThrottled: timer !== null,
      });

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      if (shouldCallLeading) {
        lastCallTime = now;
        lastResult = fn(...args);
        return lastResult;
      }

      if (trailing) {
        timer = setTimeout(() => {
          timer = null;
          lastCallTime = Date.now();
          lastResult = fn(...args);
        }, delay);
      }

      return lastResult;
    }) as T;
  }

  debounceByKey<T extends (...args: never[]) => unknown>(
    key: string,
    fn: T,
    delay: number = DEFAULT_DEBOUNCE_DELAY_MS,
  ): T {
    return ((...args: never[]) => {
      this.lastArgs.set(key, args);
      const existingTimer = this.timers.get(key);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        this.timers.delete(key);
        const pendingArgs = this.lastArgs.get(key);
        this.lastArgs.delete(key);
        if (pendingArgs) fn(...(pendingArgs as never[]));
      }, delay);

      this.timers.set(key, timer);
    }) as T;
  }

  cancelDebounce(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    this.lastArgs.delete(key);
  }

  flushDebounce<T extends (...args: never[]) => unknown>(
    key: string,
    fn: T,
  ): void {
    this.cancelDebounce(key);
    const args = this.lastArgs.get(key);
    if (args) {
      fn(...(args as never[]));
      this.lastArgs.delete(key);
    }
  }
}

export class ThrottleManager {
  private readonly timers = new Map<string, TimerHandle>();
  private readonly lastArgs = new Map<string, readonly unknown[]>();

  throttle<T extends (...args: never[]) => unknown>(
    fn: T,
    options: ThrottleOptions = {},
  ): T {
    const interval = options.interval ?? DEFAULT_THROTTLE_INTERVAL_MS;
    const leading = options.leading ?? true;
    const trailing = options.trailing ?? false;

    let timer: TimerHandle | null = null;
    let lastCallTime = 0;
    let lastResult: unknown;
    let pendingArgs: readonly unknown[] | null = null;

    return ((...args: never[]) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;
      const shouldCall = shouldCallOnLeadingEdge({
        now,
        lastCallTime,
        interval,
        leadingEnabled: leading,
        isThrottled: timer !== null,
      });
      pendingArgs = args;

      if (shouldCall) {
        lastCallTime = now;
        lastResult = fn(...args);
        return lastResult;
      }

      if (trailing && !timer) {
        const delay = calculateTrailingDelay({ interval, timeSinceLastCall });
        timer = setTimeout(() => {
          timer = null;
          lastCallTime = Date.now();
          if (pendingArgs) {
            lastResult = fn(...(pendingArgs as never[]));
            pendingArgs = null;
          }
        }, delay);
      }

      return lastResult;
    }) as T;
  }

  throttleByKey<T extends (...args: never[]) => unknown>(
    key: string,
    fn: T,
    interval: number = DEFAULT_THROTTLE_INTERVAL_MS,
  ): T {
    return ((...args: never[]) => {
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        this.lastArgs.set(key, args);
        return;
      }

      fn(...args);

      const timer = setTimeout(() => {
        this.timers.delete(key);
        const pendingArgs = this.lastArgs.get(key);
        if (pendingArgs) {
          this.lastArgs.delete(key);
          fn(...(pendingArgs as never[]));
          const nextTimer = setTimeout(() => {
            this.timers.delete(key);
          }, interval);
          this.timers.set(key, nextTimer);
        }
      }, interval);

      this.timers.set(key, timer);
    }) as T;
  }

  cancelThrottle(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    this.lastArgs.delete(key);
  }

  isThrottled(key: string): boolean {
    return this.timers.has(key);
  }
}

export const debounceManager = new DebounceManager();
export const throttleManager = new ThrottleManager();

export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  delay?: number,
): T {
  return debounceManager.debounce(fn, { delay });
}

export function throttle<T extends (...args: never[]) => unknown>(
  fn: T,
  interval?: number,
): T {
  return throttleManager.throttle(fn, { interval });
}
