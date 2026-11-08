
import { SpeechPaceConfig } from '../limits/SpeechPaceConfig';

export function estimateWordCountForDuration(durationSeconds: number): number {
  return Math.floor(durationSeconds * SpeechPaceConfig.WORDS_PER_SECOND);
}

export function estimateTokenBudgetForDuration(durationSeconds: number): number {
  return durationSeconds * SpeechPaceConfig.TOKENS_PER_SECOND + SpeechPaceConfig.JSON_TOKEN_OVERHEAD;
}

export function estimateTokenBudgetForCalendarDays(days: number): number {
  return days * SpeechPaceConfig.TOKENS_PER_CALENDAR_DAY + SpeechPaceConfig.JSON_TOKEN_OVERHEAD;
}
