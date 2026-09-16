import { describe, expect, it } from 'vitest';

import { TIME_WINDOWS } from './asset360Types';
import { resolveTimeWindow, timeWindowLabel, timeWindowShortLabel } from './timeWindow';

const NOW = Date.parse('2026-03-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe(resolveTimeWindow.name, () => {
  it('ends the window at now and starts it one window earlier', () => {
    const window = resolveTimeWindow('24h', NOW);
    expect(window.end).toBe(NOW);
    expect(window.start).toBe(NOW - 24 * HOUR);
  });

  it('widens the granularity as the window grows, keeping point counts readable', () => {
    expect(resolveTimeWindow('24h', NOW).granularity).toBe('5m');
    expect(resolveTimeWindow('7d', NOW).granularity).toBe('1h');
    expect(resolveTimeWindow('30d', NOW).granularity).toBe('6h');
  });

  it('caps the points requested per series for every window', () => {
    for (const id of TIME_WINDOWS) {
      expect(resolveTimeWindow(id, NOW).pointLimit).toBeGreaterThan(0);
      expect(resolveTimeWindow(id, NOW).pointLimit).toBeLessThanOrEqual(1000);
    }
  });
});

describe('time window labels', () => {
  it('gives every window a full and a short label', () => {
    for (const id of TIME_WINDOWS) {
      expect(timeWindowLabel(id).length).toBeGreaterThan(0);
      expect(timeWindowShortLabel(id)).toBe(id);
    }
  });
});
