import { describe, expect, it } from 'vitest';

import { buildChartGeometry } from './chartGeometry';

const START = 1000;
const END = 2000;

describe(buildChartGeometry.name, () => {
  it('returns an empty, finite model when there is no data', () => {
    const model = buildChartGeometry([], START, END);

    expect(model.series).toEqual([]);
    expect(model.yMin).toBe(0);
    expect(model.yMax).toBe(1);
  });

  it('positions one point without creating an invalid line', () => {
    const model = buildChartGeometry(
      [{ id: 'one', label: 'One', points: [{ timestamp: 1500, value: 4.2 }] }],
      START,
      END
    );

    expect(model.series[0]?.points).toHaveLength(1);
    expect(model.series[0]?.segments).toEqual([]);
    expect(allCoordinatesAreFinite(model)).toBe(true);
  });

  it('creates a visible line through multiple points', () => {
    const model = buildChartGeometry(
      [
        {
          id: 'many',
          label: 'Many',
          points: [
            { timestamp: 1000, value: 1 },
            { timestamp: 1500, value: 2 },
            { timestamp: 2000, value: 3 },
          ],
        },
      ],
      START,
      END
    );

    expect(model.series[0]?.segments[0]).toMatch(/^M .+ L .+ L .+$/);
    expect(allCoordinatesAreFinite(model)).toBe(true);
  });

  it('pads identical values so the Y domain never collapses', () => {
    const model = buildChartGeometry(
      [
        {
          id: 'flat',
          label: 'Flat',
          points: [
            { timestamp: 1000, value: 5 },
            { timestamp: 2000, value: 5 },
          ],
        },
      ],
      START,
      END
    );

    expect(model.yMin).toBeLessThan(5);
    expect(model.yMax).toBeGreaterThan(5);
    expect(allCoordinatesAreFinite(model)).toBe(true);
  });

  it.each([
    ['very small', 0.000000001, 0.000000002],
    ['very large', -1_000_000_000, 1_000_000_000],
  ])('keeps %s value ranges finite', (_label, low, high) => {
    const model = buildChartGeometry(
      [
        {
          id: 'range',
          label: 'Range',
          points: [
            { timestamp: 1000, value: low },
            { timestamp: 2000, value: high },
          ],
        },
      ],
      START,
      END
    );

    expect(allCoordinatesAreFinite(model)).toBe(true);
    expect(model.yMax).toBeGreaterThan(model.yMin);
  });

  it('splits an explicit gap instead of interpolating across it', () => {
    const model = buildChartGeometry(
      [
        {
          id: 'gapped',
          label: 'Gapped',
          points: [
            { timestamp: 1000, value: 1 },
            { timestamp: 1250, value: 2 },
            { timestamp: 1500, value: null },
            { timestamp: 1750, value: 3 },
            { timestamp: 2000, value: 4 },
          ],
        },
      ],
      START,
      END
    );

    expect(model.series[0]?.segments).toHaveLength(2);
    expect(model.series[0]?.points).toHaveLength(4);
  });

  it('handles a collapsed or reversed time domain without invalid coordinates', () => {
    const model = buildChartGeometry(
      [{ id: 'one', label: 'One', points: [{ timestamp: 1000, value: 1 }] }],
      START,
      START
    );

    expect(allCoordinatesAreFinite(model)).toBe(true);
  });
});

function allCoordinatesAreFinite(
  model: ReturnType<typeof buildChartGeometry>
): boolean {
  return model.series.every((series) =>
    series.points.every(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
    )
  );
}
