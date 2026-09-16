import type { TimeWindowId } from './asset360Types';

export type TimeWindow = {
  id: TimeWindowId;
  label: string;
  start: number;
  end: number;
  /** Aggregate granularity, chosen so every window yields a readable point count. */
  granularity: string;
  /** Upper bound on aggregate points per series for this granularity. */
  pointLimit: number;
};

const HOUR_MS = 60 * 60 * 1000;

const PRESETS: Record<TimeWindowId, { label: string; hours: number; granularity: string; pointLimit: number }> = {
  '24h': { label: 'Last 24 hours', hours: 24, granularity: '5m', pointLimit: 300 },
  '7d': { label: 'Last 7 days', hours: 24 * 7, granularity: '1h', pointLimit: 200 },
  '30d': { label: 'Last 30 days', hours: 24 * 30, granularity: '6h', pointLimit: 150 },
};

export function resolveTimeWindow(id: TimeWindowId, now: number): TimeWindow {
  const preset = PRESETS[id];
  return {
    id,
    label: preset.label,
    start: now - preset.hours * HOUR_MS,
    end: now,
    granularity: preset.granularity,
    pointLimit: preset.pointLimit,
  };
}

export function timeWindowLabel(id: TimeWindowId): string {
  return PRESETS[id].label;
}

/** Short label for the window selector, which has little horizontal room. */
export function timeWindowShortLabel(id: TimeWindowId): string {
  return id === '24h' ? '24h' : id === '7d' ? '7d' : '30d';
}
