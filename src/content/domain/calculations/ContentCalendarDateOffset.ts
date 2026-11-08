
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function resolveCalendarEntryDate(dayIndex: number, baseTimestamp: number = Date.now()): Date {
  return new Date(baseTimestamp + (dayIndex - 1) * ONE_DAY_MS);
}
