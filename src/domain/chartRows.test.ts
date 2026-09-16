import { describe, expect, it } from 'vitest';

import type { ChartSeries } from './asset360Types';
import { seriesKey, toChartRows } from './chartRows';

describe(toChartRows.name, () => {
  it('merges series onto one sorted timestamp axis', () => {
    const rows = toChartRows([
      series('a', [
        { timestamp: 200, value: 2 },
        { timestamp: 100, value: 1 },
      ]),
      series('b', [{ timestamp: 100, value: 10 }]),
    ]);

    expect(rows).toEqual([
      { timestamp: 100, s0: 1, s1: 10 },
      { timestamp: 200, s0: 2 },
    ]);
  });

  it('leaves a gap rather than a zero where a series has no point', () => {
    const rows = toChartRows([series('a', [{ timestamp: 100, value: 1 }]), series('b', [])]);

    expect(rows[0]?.s1).toBeUndefined();
  });

  it('keeps a genuine zero reading', () => {
    expect(toChartRows([series('a', [{ timestamp: 100, value: 0 }])])[0]?.s0).toBe(0);
  });

  it('returns nothing for series without points', () => {
    expect(toChartRows([series('a', [])])).toEqual([]);
    expect(toChartRows([])).toEqual([]);
  });
});

describe(seriesKey.name, () => {
  it('keys series positionally so the key is a legal CSS custom property name', () => {
    expect(seriesKey(0)).toBe('s0');
    expect(seriesKey(3)).toBe('s3');
  });
});

function series(externalId: string, points: ChartSeries['points']): ChartSeries {
  return {
    ref: { space: 'test-instances', externalId },
    label: externalId,
    points,
  };
}
