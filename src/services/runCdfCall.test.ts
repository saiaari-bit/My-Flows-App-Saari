import { CogniteError, HttpError } from '@cognite/sdk';
import { describe, expect, it, vi } from 'vitest';

import { CDF_MAX_ATTEMPTS, runCdfCall } from './runCdfCall';

describe(runCdfCall.name, () => {
  it('returns the result without sleeping when the call succeeds', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>();

    const result = await runCdfCall(async () => 'ok', { sleep, schedule: runNow });

    expect(result).toBe('ok');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a 429 and then returns the later success', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new CogniteError('Too many requests', 429))
      .mockResolvedValueOnce('ok');
    const sleeps: number[] = [];

    const result = await runCdfCall(fn, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0,
      schedule: runNow,
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([200]);
  });

  it('stops after the attempt cap and rethrows the last 429', async () => {
    const cause = new CogniteError('Too many requests', 429);
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(cause);
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined);

    await expect(runCdfCall(fn, { sleep, random: () => 0, schedule: runNow })).rejects.toBe(cause);
    expect(fn).toHaveBeenCalledTimes(CDF_MAX_ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(CDF_MAX_ATTEMPTS - 1);
  });

  it('does not retry a non-429 failure', async () => {
    const cause = new CogniteError('Forbidden', 403);
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(cause);
    const sleep = vi.fn<(ms: number) => Promise<void>>();

    await expect(runCdfCall(fn, { sleep, schedule: runNow })).rejects.toBe(cause);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('honors a numeric Retry-After header instead of the fallback delay', async () => {
    const cause = new HttpError(429, { error: { code: 429, message: 'Too many requests' } }, {
      'Retry-After': '2',
    });
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(cause)
      .mockResolvedValueOnce('ok');
    const sleeps: number[] = [];

    await runCdfCall(fn, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 1,
      schedule: runNow,
    });

    expect(sleeps).toEqual([2000]);
  });
});

function runNow<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}
