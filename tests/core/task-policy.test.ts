import { describe, expect, it } from 'vitest';
import {
  canStartTask,
  nextAttemptDelayMs,
  planTaskFailure,
  planStuckRecovery,
  STUCK_TASK_THRESHOLD_MS,
  DEFAULT_TASK_POLICIES,
} from '../../src/core/calculations/task-policy';

const NOW = new Date('2026-11-08T12:00:00.000Z');

describe('nextAttemptDelayMs', () => {
  it('grows exponentially from the base', () => {
    expect(nextAttemptDelayMs(1, 2000)).toBe(2000);
    expect(nextAttemptDelayMs(2, 2000)).toBe(4000);
    expect(nextAttemptDelayMs(3, 2000)).toBe(8000);
  });

  it('caps the delay at 30 seconds', () => {
    expect(nextAttemptDelayMs(6, 2000)).toBe(30000);
    expect(nextAttemptDelayMs(20, 2000)).toBe(30000);
  });

  it('never returns a negative or zero delay', () => {
    expect(nextAttemptDelayMs(0, 500)).toBe(500);
  });
});

describe('canStartTask', () => {
  it('starts queued tasks with no scheduled retry immediately', () => {
    expect(canStartTask({ status: 'queued', nextAttemptAt: null }, NOW)).toBe(true);
  });

  it('waits for the scheduled retry time', () => {
    const future = new Date(NOW.getTime() + 5000).toISOString();
    const past = new Date(NOW.getTime() - 5000).toISOString();
    expect(canStartTask({ status: 'queued', nextAttemptAt: future }, NOW)).toBe(false);
    expect(canStartTask({ status: 'queued', nextAttemptAt: past }, NOW)).toBe(true);
  });

  it('never starts non-queued tasks', () => {
    expect(canStartTask({ status: 'running', nextAttemptAt: null }, NOW)).toBe(false);
    expect(canStartTask({ status: 'succeeded', nextAttemptAt: null }, NOW)).toBe(false);
    expect(canStartTask({ status: 'cancelled', nextAttemptAt: null }, NOW)).toBe(false);
  });
});

describe('planTaskFailure', () => {
  it('schedules a retry with backoff while attempts remain', () => {
    const plan = planTaskFailure({ attempts: 1, maxAttempts: 3 }, 'provider unreachable', 2000, NOW);
    expect(plan.status).toBe('queued');
    expect(plan.nextAttemptAt).toBe(new Date(NOW.getTime() + 2000).toISOString());
    expect(plan.log.level).toBe('error');
    expect(plan.log.message).toContain('retry scheduled');
    const second = planTaskFailure({ attempts: 2, maxAttempts: 3 }, 'still down', 2000, NOW);
    expect(second.nextAttemptAt).toBe(new Date(NOW.getTime() + 4000).toISOString());
  });

  it('fails terminally when attempts are exhausted', () => {
    const plan = planTaskFailure({ attempts: 3, maxAttempts: 3 }, 'provider unreachable', 2000, NOW);
    expect(plan.status).toBe('failed');
    expect(plan.nextAttemptAt).toBeNull();
    expect(plan.log.message).toBe('provider unreachable');
  });

  it('keeps the log entry timestamped', () => {
    const plan = planTaskFailure({ attempts: 1, maxAttempts: 2 }, 'boom', 1000, NOW);
    expect(plan.log.at).toBe(NOW.toISOString());
  });
});

describe('planStuckRecovery', () => {
  it('leaves fresh running tasks alone', () => {
    const updatedAt = new Date(NOW.getTime() - 60_000);
    expect(planStuckRecovery({ attempts: 1, maxAttempts: 3, updatedAt }, NOW)).toBeNull();
  });

  it('requeues stale tasks while attempts remain', () => {
    const updatedAt = new Date(NOW.getTime() - STUCK_TASK_THRESHOLD_MS - 1000);
    expect(planStuckRecovery({ attempts: 1, maxAttempts: 3, updatedAt }, NOW)).toEqual({ action: 'requeue' });
  });

  it('fails stale tasks whose attempts are exhausted', () => {
    const updatedAt = new Date(NOW.getTime() - STUCK_TASK_THRESHOLD_MS - 1000);
    expect(planStuckRecovery({ attempts: 3, maxAttempts: 3, updatedAt }, NOW)).toEqual({ action: 'fail' });
  });

  it('honours a custom threshold', () => {
    const updatedAt = new Date(NOW.getTime() - 5000);
    expect(planStuckRecovery({ attempts: 1, maxAttempts: 3, updatedAt }, NOW, 1000)).toEqual({ action: 'requeue' });
    expect(planStuckRecovery({ attempts: 1, maxAttempts: 3, updatedAt }, NOW, 10_000)).toBeNull();
  });
});

describe('DEFAULT_TASK_POLICIES', () => {
  it('defines bounded retries for task kinds', () => {
    for (const policy of Object.values(DEFAULT_TASK_POLICIES)) {
      expect(policy.maxAttempts).toBeGreaterThan(0);
      expect(policy.maxAttempts).toBeLessThanOrEqual(5);
      expect(policy.backoffBaseMs).toBeGreaterThan(0);
    }
  });
});
