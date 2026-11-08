
import { ValidationLimits } from '../limits/ValidationLimits';
import { ValidationError } from '../errors/AIErrors';

export function validateCalendarDays(days: number): number {
  if (!Number.isFinite(days)) {
    throw new ValidationError(
      `Days must be between ${ValidationLimits.CALENDAR_DAYS.MIN} and ${ValidationLimits.CALENDAR_DAYS.MAX}`,
    );
  }
  if (days < ValidationLimits.CALENDAR_DAYS.MIN || days > ValidationLimits.CALENDAR_DAYS.MAX) {
    throw new ValidationError(
      `Days must be between ${ValidationLimits.CALENDAR_DAYS.MIN} and ${ValidationLimits.CALENDAR_DAYS.MAX}`,
    );
  }
  return days;
}
