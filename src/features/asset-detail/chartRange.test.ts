import { describe, expect, it } from 'vitest';

import {
  RANGE_PRESET_OPTIONS,
  latestDatapointAnchor,
  resolveChartRange,
} from './chartRange';

const END = Date.parse('2026-08-27T12:00:00.000Z');

describe(resolveChartRange.name, () => {
  it.each([
    ['last24h', 24 * 60 * 60 * 1000],
    ['last7d', 7 * 24 * 60 * 60 * 1000],
    ['last30d', 30 * 24 * 60 * 60 * 1000],
  ] as const)('resolves %s relative to the latest datapoint', (presetKey, duration) => {
    expect(resolveChartRange({ presetKey }, END)).toEqual({
      presetKey,
      start: END - duration,
      end: END,
    });
  });

  it('uses last 24 hours as the unsynced default range', () => {
    expect(resolveChartRange(undefined, END)).toEqual({
      presetKey: 'last24h',
      start: END - 24 * 60 * 60 * 1000,
      end: END,
    });
  });

  it('preserves complete bounds restored from a deep link', () => {
    expect(
      resolveChartRange(
        { presetKey: 'last7d', start: END - 1000, end: END },
        END + 5000
      )
    ).toEqual({
      presetKey: 'last7d',
      start: END - 1000,
      end: END,
    });
  });

  it('cannot resolve an implicit range without a latest datapoint', () => {
    expect(resolveChartRange(undefined, undefined)).toBeUndefined();
  });

  it('falls back to the preset duration for invalid restored bounds', () => {
    expect(
      resolveChartRange({ presetKey: 'last7d', start: END, end: END }, END)
    ).toEqual({
      presetKey: 'last7d',
      start: END - 7 * 24 * 60 * 60 * 1000,
      end: END,
    });
  });

  it('exposes only the three host-state presets', () => {
    expect(RANGE_PRESET_OPTIONS.map((option) => option.key)).toEqual([
      'last24h',
      'last7d',
      'last30d',
    ]);
  });
});

describe(latestDatapointAnchor.name, () => {
  it('uses the newest non-null datapoint across the selection', () => {
    expect(
      latestDatapointAnchor([
        { datapoint: { timestamp: END - 1000, value: 1 } },
        { datapoint: null },
        { datapoint: { timestamp: END, value: 2 } },
      ])
    ).toBe(END);
  });

  it('returns undefined when no selected series has data', () => {
    expect(latestDatapointAnchor([{ datapoint: null }])).toBeUndefined();
  });
});
