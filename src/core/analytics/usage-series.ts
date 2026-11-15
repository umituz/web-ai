/**
 * Usage analytics over sparse day aggregates.
 *
 * Servers typically bucket usage rows per UTC day in SQL and hand back only
 * the days that have data. These helpers turn those sparse rows into a
 * zero-filled daily series and derive the window totals / trends / error
 * rates a usage dashboard needs — pure functions, no persistence coupling.
 */

/** One point of a zero-filled daily series (UTC `YYYY-MM-DD` date keys). */
export interface UsageSeriesPoint {
  readonly date: string;
  readonly requests: number;
  readonly attempts: number;
  readonly errors: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly costMicros: number;
}

/** Sparse usage aggregate for a day, straight from SQL. Numbers may arrive
 *  as strings depending on the driver (pg/bigint columns). */
export interface UsageSeriesDayRow {
  readonly date: string;
  readonly requests?: number | string | null;
  readonly inputTokens?: number | string | null;
  readonly outputTokens?: number | string | null;
  readonly reasoningTokens?: number | string | null;
  readonly costMicros?: number | string | null;
}

/** Sparse message-attempt aggregate for a day (attempts vs errors). */
export interface UsageSeriesMessageRow {
  readonly date: string;
  readonly attempts?: number | string | null;
  readonly errors?: number | string | null;
}

export interface UsageWindowTotals {
  readonly requests: number;
  readonly attempts: number;
  readonly errors: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costMicros: number;
}

export interface UsageTrendPoint {
  readonly current: number;
  readonly previous: number;
  /** Percentage change; null when the previous window was empty (avoid ±∞). */
  readonly deltaPct: number | null;
}

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function utcDateKey(base: Date, offsetDays: number): string {
  const shifted = new Date(base.getTime() - offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Merge sparse SQL day aggregates into a zero-filled series covering the
 * last `days` UTC days ending today. Both trend windows (current +
 * previous) fit in the result when called with the doubled length.
 */
export function buildUsageDailySeries(
  days: number,
  usageRows: readonly UsageSeriesDayRow[],
  messageRows: readonly UsageSeriesMessageRow[],
  today: Date = new Date(),
): UsageSeriesPoint[] {
  const usageByDate = new Map(usageRows.map((row) => [row.date, row]));
  const messageByDate = new Map(messageRows.map((row) => [row.date, row]));
  const series: UsageSeriesPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = utcDateKey(today, offset);
    const usage = usageByDate.get(date);
    const message = messageByDate.get(date);
    series.push({
      date,
      requests: num(usage?.requests),
      attempts: num(message?.attempts),
      errors: num(message?.errors),
      inputTokens: num(usage?.inputTokens),
      outputTokens: num(usage?.outputTokens),
      reasoningTokens: num(usage?.reasoningTokens),
      costMicros: num(usage?.costMicros),
    });
  }
  return series;
}

/** Sum a contiguous slice of the daily series. `to` is exclusive; both may
 *  be negative (Python-style windowing over the tail of the series). */
export function usageWindowTotals(
  series: readonly UsageSeriesPoint[],
  from: number,
  to: number,
): UsageWindowTotals {
  const slice = series.slice(from, to);
  return slice.reduce<UsageWindowTotals>(
    (acc, day) => ({
      requests: acc.requests + day.requests,
      attempts: acc.attempts + day.attempts,
      errors: acc.errors + day.errors,
      inputTokens: acc.inputTokens + day.inputTokens,
      outputTokens: acc.outputTokens + day.outputTokens,
      costMicros: acc.costMicros + day.costMicros,
    }),
    { requests: 0, attempts: 0, errors: 0, inputTokens: 0, outputTokens: 0, costMicros: 0 },
  );
}

/** Percentage change between two windows; null when the previous window is empty. */
export function usageTrendOf(current: number, previous: number): UsageTrendPoint {
  return {
    current,
    previous,
    deltaPct: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

/** Errors / attempts as a percentage (0–100); 0 when there were no attempts. */
export function errorRatePct(errors: number, attempts: number): number {
  if (attempts <= 0) return 0;
  return (errors / attempts) * 100;
}
