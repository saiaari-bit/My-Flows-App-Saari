import type {
  TimeRange,
  TimeRangePreset,
} from '@/host/hostState';
import type { LatestDatapoint } from '@/services/timeSeriesService';

export type ResolvedChartRange = {
  presetKey: TimeRangePreset;
  start: number;
  end: number;
};

export const RANGE_PRESET_OPTIONS: ReadonlyArray<{
  key: TimeRangePreset;
  label: string;
  durationMs: number;
}> = [
  { key: 'last24h', label: '24 hours', durationMs: 24 * 60 * 60 * 1000 },
  { key: 'last7d', label: '7 days', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { key: 'last30d', label: '30 days', durationMs: 30 * 24 * 60 * 60 * 1000 },
];

export function latestDatapointAnchor(
  latest: readonly LatestDatapoint[]
): number | undefined {
  let newest: number | undefined;
  for (const series of latest) {
    const timestamp = series.datapoint?.timestamp;
    if (timestamp === undefined) continue;
    if (newest === undefined || timestamp > newest) newest = timestamp;
  }
  return newest;
}

/**
 * Resolves host state into concrete bounds without consulting wall-clock time.
 * Complete deep-linked bounds win; otherwise the selected preset is anchored
 * to the newest datapoint across the current selection.
 */
export function resolveChartRange(
  range: TimeRange | undefined,
  latestAnchor: number | undefined
): ResolvedChartRange | undefined {
  const presetKey = range?.presetKey ?? 'last24h';
  if (
    range?.start !== undefined &&
    range.end !== undefined &&
    range.start < range.end
  ) {
    return { presetKey, start: range.start, end: range.end };
  }

  const end = range?.end ?? latestAnchor;
  if (end === undefined) return undefined;
  const duration = presetDuration(presetKey);
  const proposedStart = range?.start ?? end - duration;
  const start = proposedStart < end ? proposedStart : end - duration;
  return { presetKey, start, end };
}

function presetDuration(preset: TimeRangePreset): number {
  for (const option of RANGE_PRESET_OPTIONS) {
    if (option.key === preset) return option.durationMs;
  }
  return RANGE_PRESET_OPTIONS[0]?.durationMs ?? 24 * 60 * 60 * 1000;
}
