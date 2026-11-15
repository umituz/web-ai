export interface TaskPolicy {
  readonly maxAttempts: number;
  readonly backoffBaseMs: number;
}

export const DEFAULT_TASK_POLICIES: Record<string, TaskPolicy> = {
  index_document: { maxAttempts: 3, backoffBaseMs: 2000 },
  research: { maxAttempts: 2, backoffBaseMs: 5000 },
};

export function nextAttemptDelayMs(attempt: number, baseMs: number): number {
  const exponent = Math.max(attempt - 1, 0);
  return Math.min(Math.round(baseMs * Math.pow(2, exponent)), 30_000);
}

export interface TaskState {
  readonly status: string;
  readonly nextAttemptAt?: string | null;
}

export function canStartTask(task: TaskState, now: Date = new Date()): boolean {
  if (task.status !== 'queued') return false;
  if (!task.nextAttemptAt) return true;
  return new Date(task.nextAttemptAt).getTime() <= now.getTime();
}

export interface TaskPlan {
  readonly status: 'queued' | 'failed';
  readonly nextAttemptAt: string | null;
  readonly log: {
    readonly at: string;
    readonly level: 'info' | 'warn' | 'error';
    readonly message: string;
  };
}

export function planTaskFailure(
  task: { attempts: number; maxAttempts: number },
  errorDetail: string,
  backoffBaseMs: number,
  now: Date = new Date(),
): TaskPlan {
  const at = now.toISOString();
  if (task.attempts < task.maxAttempts) {
    const delay = nextAttemptDelayMs(task.attempts, backoffBaseMs);
    const nextAttemptAt = new Date(now.getTime() + delay).toISOString();
    return {
      status: 'queued',
      nextAttemptAt,
      log: {
        at,
        level: 'error',
        message: `Attempt ${task.attempts} failed: ${errorDetail} — retry scheduled for ${nextAttemptAt}`,
      },
    };
  }
  return {
    status: 'failed',
    nextAttemptAt: null,
    log: {
      at,
      level: 'error',
      message: errorDetail,
    },
  };
}

/** A task found in `running` is considered stuck after this long. */
export const STUCK_TASK_THRESHOLD_MS = 15 * 60 * 1000;

export interface StuckTaskState {
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly updatedAt: Date;
}

export type StuckTaskPlan = { readonly action: 'requeue' } | { readonly action: 'fail' };

/**
 * Pure recovery decision for a task found in `running`: null means it is
 * fresh, leave it alone. Stale with attempts left → requeue; stale and
 * exhausted → fail (avoids endless requeue loops). The claiming worker may
 * be gone (ephemeral isolates), so nothing else would ever finish it.
 */
export function planStuckRecovery(
  task: StuckTaskState,
  now: Date = new Date(),
  thresholdMs: number = STUCK_TASK_THRESHOLD_MS,
): StuckTaskPlan | null {
  if (now.getTime() - task.updatedAt.getTime() < thresholdMs) return null;
  return task.attempts >= task.maxAttempts ? { action: 'fail' } : { action: 'requeue' };
}
