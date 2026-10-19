/**
 * Limits how many CDF requests run at once.
 *
 * Search plus the three asset panels can fire together. A small cap keeps that
 * burst inside the project's concurrency budget instead of turning it into HTTP 429s.
 */
const DEFAULT_MAX_CONCURRENT_TASKS = 4;

type PendingTask = {
  run: () => Promise<void>;
};

export class CdfTaskRunner {
  private readonly pending: PendingTask[] = [];
  private active = 0;

  constructor(private readonly maxConcurrent: number = DEFAULT_MAX_CONCURRENT_TASKS) {}

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pending.push({
        run: async () => {
          try {
            resolve(await fn());
          } catch (error) {
            reject(error);
          }
        },
      });
      this.pump();
    });
  }

  private pump(): void {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const next = this.pending.shift();
      if (next === undefined) return;
      this.active += 1;
      void next.run().finally(() => {
        this.active -= 1;
        this.pump();
      });
    }
  }
}

export const cdfTaskRunner = new CdfTaskRunner();
