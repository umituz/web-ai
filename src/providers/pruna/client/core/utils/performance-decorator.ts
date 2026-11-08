
import { getPerformanceMonitor } from './performance-monitor';

type AsyncFunction<TArgs extends unknown[]> = (...args: TArgs) => Promise<unknown>;

const LOG_PREFIX = '[pruna]';

export function withPerformanceMonitoring<T extends AsyncFunction<unknown[]>>(
  fn: T,
  label?: string,
): T {
  return (async (...args: unknown[]) => {
    const monitor = getPerformanceMonitor();
    const start = monitor.startRequest();

    if (label !== undefined) {
      console.time(`${LOG_PREFIX} ${label}`);
    }

    try {
      return await fn(...args);
    } finally {
      monitor.endRequest(start);
      if (label !== undefined) {
        console.timeEnd(`${LOG_PREFIX} ${label}`);
      }
    }
  }) as T;
}
