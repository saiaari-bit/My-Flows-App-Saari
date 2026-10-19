import { CogniteError, HttpError } from '@cognite/sdk';

import { cdfTaskRunner } from './cdfTaskRunner';

/** Total tries for one user action, including the first request. */
export const CDF_MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 200;
const MAX_DELAY_MS = 8_000;

export type RunCdfCallDeps = {
  schedule?: <T>(fn: () => Promise<T>) => Promise<T>;
  sleep?: (ms: number) => Promise<void>;
  /** Returns a value in [0, 1) used only to jitter the fallback delay. */
  random?: () => number;
  now?: () => number;
};

const defaultDeps: Required<RunCdfCallDeps> = {
  schedule: (fn) => cdfTaskRunner.schedule(fn),
  sleep: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  random: () => Math.random(),
  now: () => Date.now(),
};

/**
 * Runs one CDF request on the shared queue.
 *
 * HTTP 429 is retried inside this same call, with exponential backoff, so a
 * throttle does not become a second user-visible refresh. Any other failure,
 * including a 429 that survives the attempt cap, is rethrown for the caller
 * to classify.
 */
export function runCdfCall<T>(fn: () => Promise<T>, overrides?: RunCdfCallDeps): Promise<T> {
  const deps: Required<RunCdfCallDeps> = { ...defaultDeps, ...overrides };
  return deps.schedule(() => attempt(fn, deps, 1));
}

async function attempt<T>(
  fn: () => Promise<T>,
  deps: Required<RunCdfCallDeps>,
  attemptNumber: number
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (readStatus(error) !== 429 || attemptNumber >= CDF_MAX_ATTEMPTS) {
      throw error;
    }
    await deps.sleep(retryDelayMs(error, attemptNumber, deps));
    return attempt(fn, deps, attemptNumber + 1);
  }
}

function retryDelayMs(error: unknown, attemptNumber: number, deps: Required<RunCdfCallDeps>): number {
  const retryAfter = readRetryAfterMs(error, deps.now());
  if (retryAfter !== undefined) return retryAfter;

  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attemptNumber - 1));
  const jitter = Math.floor(deps.random() * exponential * 0.25);
  return Math.min(MAX_DELAY_MS, exponential + jitter);
}

function readStatus(error: unknown): number | undefined {
  if (error instanceof CogniteError || error instanceof HttpError) return error.status;
  return undefined;
}

function readRetryAfterMs(error: unknown, now: number): number | undefined {
  if (!(error instanceof HttpError)) return undefined;
  const raw = headerValue(error.headers, 'retry-after');
  if (raw === undefined) return undefined;

  const seconds = Number(raw);
  if (raw.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_DELAY_MS, seconds * 1000);
  }

  const date = Date.parse(raw);
  if (Number.isNaN(date)) return undefined;
  return Math.min(MAX_DELAY_MS, Math.max(0, date - now));
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const direct = headers[name];
  if (typeof direct === 'string') return direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return match?.[1];
}
