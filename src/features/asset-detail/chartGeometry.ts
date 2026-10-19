export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 320;
export const CHART_PADDING = {
  top: 20,
  right: 20,
  bottom: 48,
  left: 64,
};

export type ChartPoint = {
  timestamp: number;
  /** `null` is an explicit gap and splits the SVG path. */
  value: number | null;
};

export type ChartSeries = {
  id: string;
  label: string;
  unit?: string;
  points: ChartPoint[];
};

export type PositionedChartPoint = {
  timestamp: number;
  value: number;
  x: number;
  y: number;
};

export type PositionedChartSeries = {
  id: string;
  label: string;
  unit?: string;
  points: PositionedChartPoint[];
  segments: string[];
};

export type ChartGeometry = {
  yMin: number;
  yMax: number;
  series: PositionedChartSeries[];
};

export function buildChartGeometry(
  source: readonly ChartSeries[],
  start: number,
  end: number
): ChartGeometry {
  const values = source.flatMap((series) =>
    series.points.flatMap((point) =>
      point.value !== null && Number.isFinite(point.value) ? [point.value] : []
    )
  );
  const [yMin, yMax] = paddedDomain(values);
  const safeEnd = end > start ? end : start + 1;

  return {
    yMin,
    yMax,
    series: source.map((series) =>
      positionSeries(series, start, safeEnd, yMin, yMax)
    ),
  };
}

function paddedDomain(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  let minimum = values[0] ?? 0;
  let maximum = minimum;
  for (const value of values) {
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  if (minimum === maximum) {
    const padding = Math.max(Math.abs(minimum) * 0.05, 1);
    return [minimum - padding, maximum + padding];
  }
  const padding = (maximum - minimum) * 0.05;
  return [minimum - padding, maximum + padding];
}

function positionSeries(
  series: ChartSeries,
  start: number,
  end: number,
  yMin: number,
  yMax: number
): PositionedChartSeries {
  const points: PositionedChartPoint[] = [];
  const segments: string[] = [];
  let currentSegment: PositionedChartPoint[] = [];

  const finishSegment = () => {
    if (currentSegment.length >= 2) {
      segments.push(toPath(currentSegment));
    }
    currentSegment = [];
  };

  for (const point of series.points) {
    if (
      point.value === null ||
      !Number.isFinite(point.value) ||
      !Number.isFinite(point.timestamp)
    ) {
      finishSegment();
      continue;
    }
    const positioned = {
      timestamp: point.timestamp,
      value: point.value,
      x: scaleX(point.timestamp, start, end),
      y: scaleY(point.value, yMin, yMax),
    };
    points.push(positioned);
    currentSegment.push(positioned);
  }
  finishSegment();

  return {
    id: series.id,
    label: series.label,
    unit: series.unit,
    points,
    segments,
  };
}

function scaleX(timestamp: number, start: number, end: number): number {
  const ratio = clamp((timestamp - start) / (end - start), 0, 1);
  return CHART_PADDING.left + ratio * plotWidth();
}

function scaleY(value: number, minimum: number, maximum: number): number {
  const ratio = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return CHART_PADDING.top + (1 - ratio) * plotHeight();
}

function plotWidth(): number {
  return CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
}

function plotHeight(): number {
  return CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function toPath(points: readonly PositionedChartPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}
