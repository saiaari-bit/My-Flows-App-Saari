import {
  CHART_HEIGHT,
  CHART_PADDING,
  CHART_WIDTH,
  buildChartGeometry,
} from './chartGeometry';
import type { ChartSeries, PositionedChartPoint } from './chartGeometry';

type TimeSeriesChartProps = {
  series: ChartSeries[];
  start: number;
  end: number;
};

const DASH_PATTERNS = [undefined, '8 4', '2 4', '10 3 2 3'];

/**
 * Reusable, presentational SVG trend chart. It knows nothing about CDF, query
 * state, host state, or service identities beyond the labels supplied in props.
 */
export function TimeSeriesChart({ series, start, end }: TimeSeriesChartProps) {
  const geometry = buildChartGeometry(series, start, end);
  const pointCount = geometry.series.reduce(
    (total, item) => total + item.points.length,
    0
  );
  if (pointCount === 0) {
    return <p className="text-muted-foreground">No numeric datapoints to display.</p>;
  }

  const labels = geometry.series
    .filter((item) => item.points.length > 0)
    .map((item) => item.label);
  const accessibleLabel = `Historical trend for ${labels.join(', ')}`;
  const plotBottom = CHART_HEIGHT - CHART_PADDING.bottom;
  const plotRight = CHART_WIDTH - CHART_PADDING.right;

  return (
    <figure className="min-w-0">
      <svg
        aria-label={accessibleLabel}
        className="h-auto w-full text-primary"
        height={CHART_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        width="100%"
      >
        <title>{accessibleLabel}</title>
        <line
          stroke="currentColor"
          strokeOpacity="0.35"
          x1={CHART_PADDING.left}
          x2={CHART_PADDING.left}
          y1={CHART_PADDING.top}
          y2={plotBottom}
        />
        <line
          stroke="currentColor"
          strokeOpacity="0.35"
          x1={CHART_PADDING.left}
          x2={plotRight}
          y1={plotBottom}
          y2={plotBottom}
        />
        <AxisLabels
          end={end}
          start={start}
          yMax={geometry.yMax}
          yMin={geometry.yMin}
        />
        {geometry.series.map((item, seriesIndex) => (
          <g key={item.id}>
            {item.segments.map((path, segmentIndex) => (
              <path
                d={path}
                data-series-line={item.id}
                fill="none"
                key={`${item.id}-${segmentIndex}`}
                stroke="currentColor"
                strokeDasharray={DASH_PATTERNS[seriesIndex % DASH_PATTERNS.length]}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            ))}
            {item.points.map((point, pointIndex) => (
              <DataPoint
                key={`${point.timestamp}-${pointIndex}`}
                label={item.label}
                point={point}
                unit={item.unit}
              />
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        {labels.join(', ')} · {pointCount} {pointCount === 1 ? 'point' : 'points'} ·{' '}
        {toIso(start)} to {toIso(end)}. Focus a point to inspect its value.
      </figcaption>
    </figure>
  );
}

function AxisLabels({
  end,
  start,
  yMax,
  yMin,
}: {
  end: number;
  start: number;
  yMax: number;
  yMin: number;
}) {
  const plotBottom = CHART_HEIGHT - CHART_PADDING.bottom;
  const plotRight = CHART_WIDTH - CHART_PADDING.right;
  return (
    <g fill="currentColor" fontSize="11">
      <text textAnchor="end" x={CHART_PADDING.left - 8} y={CHART_PADDING.top + 4}>
        {formatValue(yMax)}
      </text>
      <text textAnchor="end" x={CHART_PADDING.left - 8} y={plotBottom}>
        {formatValue(yMin)}
      </text>
      <text textAnchor="start" x={CHART_PADDING.left} y={plotBottom + 24}>
        {toShortIso(start)}
      </text>
      <text textAnchor="end" x={plotRight} y={plotBottom + 24}>
        {toShortIso(end)}
      </text>
      <text
        textAnchor="middle"
        transform={`rotate(-90 14 ${CHART_HEIGHT / 2})`}
        x="14"
        y={CHART_HEIGHT / 2}
      >
        Value
      </text>
      <text textAnchor="middle" x={(CHART_PADDING.left + plotRight) / 2} y={CHART_HEIGHT - 8}>
        Time
      </text>
    </g>
  );
}

function DataPoint({
  label,
  point,
  unit,
}: {
  label: string;
  point: PositionedChartPoint;
  unit?: string;
}) {
  const value = `${point.value}${unit === undefined ? '' : ` ${unit}`}`;
  return (
    <circle
      aria-label={`${label}: ${value} at ${toIso(point.timestamp)}`}
      cx={point.x}
      cy={point.y}
      data-datapoint
      fill="currentColor"
      r="3.5"
      role="graphics-symbol"
      tabIndex={0}
    >
      <title>
        {label}: {value} at {toIso(point.timestamp)}
      </title>
    </circle>
  );
}

function formatValue(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000 || (absolute > 0 && absolute < 0.001)) {
    return value.toExponential(2);
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function toShortIso(timestamp: number): string {
  return toIso(timestamp).slice(0, 16).replace('T', ' ');
}
