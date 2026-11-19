export interface LatencyMetric {
  readonly ttftMs: number;
  readonly totalMs: number;
  readonly isWithinP95: boolean;
  readonly p95ThresholdMs: number;
}

export function measureLatencyMetrics(
  startTimeMs: number,
  firstTokenTimeMs: number,
  endTimeMs: number,
  p95ThresholdMs: number,
): LatencyMetric {
  const safeStart = Math.max(0, startTimeMs);
  const safeFirst = Math.max(safeStart, firstTokenTimeMs);
  const safeEnd = Math.max(safeFirst, endTimeMs);

  const ttftMs = safeFirst - safeStart;
  const totalMs = safeEnd - safeStart;

  return {
    ttftMs,
    totalMs,
    isWithinP95: totalMs <= p95ThresholdMs,
    p95ThresholdMs,
  };
}
