import type { ChartSeries } from './asset360Types';

/**
 * One point in time across every plotted series.
 *
 * Series are keyed positionally (`s0`, `s1`, …) because an instance's external
 * id is not a legal CSS custom-property name or chart data key.
 */
export type ChartRow = Record<string, number | undefined> & { timestamp: number };

export function seriesKey(index: number): string {
  return `s${index}`;
}

/**
 * Merges series onto a shared, sorted timestamp axis.
 *
 * A series with no point at a timestamp is left absent rather than filled with
 * zero, so a gap in the data reads as a gap.
 */
export function toChartRows(series: ChartSeries[]): ChartRow[] {
  const byTimestamp = new Map<number, ChartRow>();

  series.forEach((entry, index) => {
    for (const point of entry.points) {
      const row = byTimestamp.get(point.timestamp) ?? { timestamp: point.timestamp };
      row[seriesKey(index)] = point.value;
      byTimestamp.set(point.timestamp, row);
    }
  });

  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}
