
import { createRollingAverage } from '../math/rolling-average';
import type { RollingAverage } from '../math/rolling-average';

export interface MemorySnapshot {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceSnapshot {
  memoryUsage: MemorySnapshot | null;
  requestCount: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

interface ExtendedPerformance extends Performance {
  memory?: MemorySnapshot;
}

const EMPTY_SNAPSHOT: PerformanceSnapshot = {
  memoryUsage: null,
  requestCount: 0,
  averageResponseTime: 0,
  lastRequestTime: 0,
};

export class PerformanceMonitor {
  private snapshot: PerformanceSnapshot = { ...EMPTY_SNAPSHOT };
  private rollingAverage: RollingAverage = createRollingAverage();
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  startRequest(): number {
    if (!this.enabled) return 0;
    return performance.now();
  }

  endRequest(startTime: number): void {
    if (!this.enabled || startTime === 0) return;

    const duration = performance.now() - startTime;
    this.rollingAverage.push(duration);
    this.snapshot.requestCount += 1;
    this.snapshot.lastRequestTime = duration;
    this.snapshot.averageResponseTime = this.rollingAverage.mean();
  }

  captureMemory(): void {
    if (!this.enabled) return;
    const memory = (performance as ExtendedPerformance).memory;
    if (memory) {
      this.snapshot.memoryUsage = { ...memory };
    }
  }

  getSnapshot(): PerformanceSnapshot {
    if (!this.enabled) return { ...EMPTY_SNAPSHOT };
    this.captureMemory();
    return { ...this.snapshot };
  }

  reset(): void {
    if (!this.enabled) return;
    this.snapshot = { ...EMPTY_SNAPSHOT };
    this.rollingAverage.reset();
  }
}

let globalMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor();
  }
  return globalMonitor;
}

export async function measurePerformance<T>(
  fn: () => Promise<T>,
  monitor: PerformanceMonitor = getPerformanceMonitor(),
): Promise<T> {
  const start = monitor.startRequest();
  try {
    return await fn();
  } finally {
    monitor.endRequest(start);
  }
}
