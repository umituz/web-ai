import { describe, expect, it } from "vitest";
import {
  buildUsageDailySeries,
  errorRatePct,
  usageTrendOf,
  usageWindowTotals,
} from "../../src/core/analytics/usage-series";

const TODAY = new Date("2026-11-15T12:00:00.000Z");

function dayKey(offsetDays: number): string {
  return new Date(TODAY.getTime() - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

describe("buildUsageDailySeries", () => {
  it("zero-fills days without rows and keeps the requested length", () => {
    const series = buildUsageDailySeries(
      7,
      [{ date: dayKey(0), requests: "3", inputTokens: 100, outputTokens: 50, costMicros: "12" }],
      [],
      TODAY,
    );
    expect(series).toHaveLength(7);
    expect(series[6]).toMatchObject({
      date: dayKey(0),
      requests: 3,
      attempts: 0,
      errors: 0,
      inputTokens: 100,
      outputTokens: 50,
      costMicros: 12,
    });
    expect(series[0]).toMatchObject({ date: dayKey(6), requests: 0, inputTokens: 0 });
  });

  it("merges usage rows and message rows onto the same day keys, oldest first", () => {
    const series = buildUsageDailySeries(
      2,
      [{ date: dayKey(1), requests: 1, inputTokens: 10, outputTokens: 5, costMicros: 2 }],
      [{ date: dayKey(1), attempts: "4", errors: 1 }],
      TODAY,
    );
    expect(series.map((d) => d.date)).toEqual([dayKey(1), dayKey(0)]);
    expect(series[0]).toMatchObject({ requests: 1, attempts: 4, errors: 1, costMicros: 2 });
  });

  it("treats null/undefined/non-numeric values as zero", () => {
    const series = buildUsageDailySeries(
      1,
      [{ date: dayKey(0), requests: null, inputTokens: undefined, costMicros: "nan" }],
      [],
      TODAY,
    );
    expect(series[0]).toMatchObject({ requests: 0, inputTokens: 0, costMicros: 0 });
  });
});

describe("usageWindowTotals", () => {
  const series = buildUsageDailySeries(
    4,
    [
      { date: dayKey(0), requests: 2, inputTokens: 20, outputTokens: 10, costMicros: 4 },
      { date: dayKey(1), requests: 1, inputTokens: 5, outputTokens: 5, costMicros: 1 },
    ],
    [
      { date: dayKey(0), attempts: 2, errors: 1 },
      { date: dayKey(1), attempts: 1, errors: 0 },
    ],
    TODAY,
  );

  it("sums a positive slice", () => {
    const totals = usageWindowTotals(series, 2, 4);
    expect(totals).toEqual({
      requests: 3,
      attempts: 3,
      errors: 1,
      inputTokens: 25,
      outputTokens: 15,
      costMicros: 5,
    });
  });

  it("supports negative tail windows (last N days)", () => {
    expect(usageWindowTotals(series, -2, series.length).requests).toBe(3);
    expect(usageWindowTotals(series, -4, -2).requests).toBe(0);
  });

  it("returns zeros for an empty slice", () => {
    expect(usageWindowTotals([], 0, 5)).toEqual({
      requests: 0,
      attempts: 0,
      errors: 0,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
    });
  });
});

describe("usageTrendOf", () => {
  it("computes percentage change", () => {
    expect(usageTrendOf(150, 100)).toEqual({ current: 150, previous: 100, deltaPct: 50 });
    expect(usageTrendOf(50, 100).deltaPct).toBe(-50);
  });

  it("returns null delta when the previous window is empty", () => {
    expect(usageTrendOf(10, 0).deltaPct).toBeNull();
  });
});

describe("errorRatePct", () => {
  it("computes errors over attempts", () => {
    expect(errorRatePct(1, 4)).toBe(25);
  });

  it("is 0 without attempts (no division by zero)", () => {
    expect(errorRatePct(3, 0)).toBe(0);
  });
});
