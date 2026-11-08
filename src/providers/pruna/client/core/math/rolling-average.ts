
import { PERFORMANCE_RETAINED_SAMPLES } from '../constants/limits';

export interface RollingAverage {
  push: (sample: number) => void;
  mean: () => number;
  size: () => number;
  reset: () => void;
}

export interface RollingAverageOptions {
  capacity?: number;
}

export function createRollingAverage(options: RollingAverageOptions = {}): RollingAverage {
  const capacity = Math.max(1, options.capacity ?? PERFORMANCE_RETAINED_SAMPLES);
  const buffer: number[] = [];
  let runningSum = 0;

  const push = (sample: number): void => {
    buffer.push(sample);
    runningSum += sample;
    if (buffer.length > capacity) {
      const dropped = buffer.shift() as number;
      runningSum -= dropped;
    }
  };

  const mean = (): number => (buffer.length === 0 ? 0 : runningSum / buffer.length);

  const size = (): number => buffer.length;

  const reset = (): void => {
    buffer.length = 0;
    runningSum = 0;
  };

  return { push, mean, size, reset };
}
