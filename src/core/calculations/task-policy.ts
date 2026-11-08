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
