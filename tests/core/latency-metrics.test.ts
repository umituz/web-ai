import { describe, expect, it } from "vitest";
import { measureLatencyMetrics } from "../../src/core/utils/latency-metrics";

describe("measureLatencyMetrics", () => {
  it("computes ttft and total latency accurately within p95", () => {
    const metric = measureLatencyMetrics(1000, 1300, 2200, 2500);
    expect(metric.ttftMs).toBe(300);
    expect(metric.totalMs).toBe(1200);
    expect(metric.isWithinP95).toBe(true);
    expect(metric.p95ThresholdMs).toBe(2500);
  });

  it("identifies p95 threshold breaches", () => {
    const breached = measureLatencyMetrics(1000, 1500, 4000, 2500);
    expect(breached.ttftMs).toBe(500);
    expect(breached.totalMs).toBe(3000);
    expect(breached.isWithinP95).toBe(false);
  });

  it("handles out of order or zero timestamps safely", () => {
    const metric = measureLatencyMetrics(-10, 0, 50, 100);
    expect(metric.ttftMs).toBe(0);
    expect(metric.totalMs).toBe(50);
    expect(metric.isWithinP95).toBe(true);
  });
});
