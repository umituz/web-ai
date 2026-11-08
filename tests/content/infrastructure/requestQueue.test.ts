import { describe, expect, it, vi } from 'vitest';
import { RequestQueue, RequestPriority, batchRequest } from '../../../src/content/infrastructure/utils/requestQueue';

const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('RequestQueue', () => {
  it('runs at most maxConcurrent tasks simultaneously', async () => {
    const queue = new RequestQueue({
      maxConcurrent: 2,
      enableRateLimit: false,
      defaultTimeout: 5000,
      retryDelay: 1,
    });
    let inFlight = 0;
    let peak = 0;

    const task = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick(40);
      inFlight -= 1;
      return inFlight;
    };

    await Promise.all([
      queue.add(task),
      queue.add(task),
      queue.add(task),
      queue.add(task),
    ]);

    expect(peak).toBeLessThanOrEqual(2);
  });

  it('passes an abort signal that fires on timeout (cancellation actually propagates)', async () => {
    const queue = new RequestQueue({
      maxConcurrent: 1,
      enableRateLimit: false,
      defaultTimeout: 50,
      retryDelay: 1,
    });

    const signalListener = vi.fn();
    const hang = (signal: AbortSignal) =>
      new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          signalListener();
          reject(new Error('underlying work aborted'));
        });
      });

    await expect(queue.add(hang, RequestPriority.NORMAL, 0)).rejects.toThrow();
    expect(signalListener).toHaveBeenCalledTimes(1);
  });

  it('resolves results in caller order regardless of priority (per-promise semantics)', async () => {
    const queue = new RequestQueue({
      maxConcurrent: 3,
      enableRateLimit: false,
      defaultTimeout: 5000,
      retryDelay: 1,
    });

    const results = await Promise.all([
      queue.add(async () => 'a'),
      queue.add(async () => 'b'),
      queue.add(async () => 'c'),
    ]);
    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('rejects queued (not running) tasks on clear()', async () => {
    const queue = new RequestQueue({
      maxConcurrent: 1,
      enableRateLimit: false,
      defaultTimeout: 5000,
      retryDelay: 1,
    });

    const slow = queue.add(async () => {
      await tick(80);
      return 'slow';
    });
    const queued = queue.add(async () => 'never');

    queue.clear();
    await expect(queued).rejects.toThrow('Queue cleared');
    await expect(slow).resolves.toBe('slow');
  });

  it('retries failed tasks up to maxRetries, then rejects', async () => {
    const queue = new RequestQueue({
      maxConcurrent: 1,
      enableRateLimit: false,
      defaultTimeout: 5000,
      retryDelay: 1,
    });

    let attempts = 0;
    const flaky = async () => {
      attempts += 1;
      throw new Error('transient');
    };

    await expect(queue.add(flaky, RequestPriority.NORMAL, 2)).rejects.toThrow('transient');
    expect(attempts).toBe(3);
  });

  it('exposes queue statistics', async () => {
    const queue = new RequestQueue({
      maxConcurrent: 1,
      enableRateLimit: false,
      defaultTimeout: 5000,
      retryDelay: 1,
    });

    const stats = queue.getStats();
    expect(stats).toHaveProperty('queued');
    expect(stats).toHaveProperty('running');
    expect(stats).toHaveProperty('rateLimitRemaining');
  });
});

describe('batchRequest', () => {
  it('executes all requests and returns fulfilled results in order', async () => {
    const results = await batchRequest([
      async () => 1,
      async () => 2,
      async () => 3,
    ]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('skips failures and warns rather than throwing by default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const results = await batchRequest([
      async () => 'ok',
      async () => {
        throw new Error('nope');
      },
    ]);
    expect(results).toEqual(['ok']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('throws on first failure when stopOnError is set', async () => {
    await expect(
      batchRequest(
        [
          async () => {
            throw new Error('fatal');
          },
        ],
        { stopOnError: true },
      ),
    ).rejects.toThrow('Batch request failed: fatal');
  });
});
