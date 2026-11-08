
const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '0s';
  if (milliseconds < MS_PER_SECOND) return `${Math.round(milliseconds)}ms`;

  const totalSeconds = Math.floor(milliseconds / MS_PER_SECOND);
  if (totalSeconds < SECONDS_PER_MINUTE) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  if (totalMinutes < MINUTES_PER_HOUR) {
    const remainingSeconds = totalSeconds % SECONDS_PER_MINUTE;
    return remainingSeconds === 0
      ? `${totalMinutes}m`
      : `${totalMinutes}m ${remainingSeconds}s`;
  }

  const totalHours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  if (totalHours < HOURS_PER_DAY) {
    const remainingMinutes = totalMinutes % MINUTES_PER_HOUR;
    return remainingMinutes === 0
      ? `${totalHours}h`
      : `${totalHours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(totalHours / HOURS_PER_DAY);
  const remainingHours = totalHours % HOURS_PER_DAY;
  return remainingHours === 0
    ? `${days}d`
    : `${days}d ${remainingHours}h`;
}

export function elapsedMilliseconds(startMs: number, endMs: number = Date.now()): number {
  return Math.max(0, endMs - startMs);
}

export function totalBackoffDelayMs(attempts: number, baseIntervalMs: number): number {
  let total = 0;
  for (let i = 0; i < attempts; i += 1) {
    total += baseIntervalMs * 2 ** i;
  }
  return total;
}
