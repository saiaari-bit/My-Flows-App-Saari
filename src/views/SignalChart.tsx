import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@cognite/aura/chart';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { instanceKey } from '../cdm/properties';
import type { ChartSeries } from '../domain/asset360Types';
import { seriesKey, toChartRows } from '../domain/chartRows';
import { formatDate, formatDateTime, formatTimeOfDay } from '../domain/format';
import type { TimeWindow } from '../domain/timeWindow';

import { PanelEmpty } from './PanelState';

/** Aura chart tokens, so series colours stay theme-aware in light and dark. */
const SERIES_COLORS = [
  'var(--chart-fjord-color-1)',
  'var(--chart-aurora-color-1)',
  'var(--chart-orange-color-1)',
  'var(--chart-nordic-color-1)',
];

type SignalChartProps = {
  series: ChartSeries[];
  window: TimeWindow;
};

/** Plots the aggregated average of each numeric signal over the window. */
export function SignalChart({ series, window }: SignalChartProps) {
  const withPoints = useMemo(() => series.filter((entry) => entry.points.length > 0), [series]);

  const config = useMemo<ChartConfig>(() => {
    const entries: ChartConfig = {};
    withPoints.forEach((entry, index) => {
      entries[seriesKey(index)] = {
        label: entry.unit === undefined ? entry.label : `${entry.label} (${entry.unit})`,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });
    return entries;
  }, [withPoints]);

  const rows = useMemo(() => toChartRows(withPoints), [withPoints]);

  if (withPoints.length === 0) {
    return (
      <PanelEmpty
        title="No data points in this window"
        description={`None of the numeric signals on this asset reported a value in the ${window.label.toLowerCase()}. Try a longer window.`}
      />
    );
  }

  const isIntraday = window.id === '24h';
  const rangeSummary = `${formatDateTime(window.start)} to ${formatDateTime(window.end)}`;

  return (
    <figure className="flex flex-col gap-2">
      <ChartContainer
        config={config}
        className="h-64 w-full"
        aria-label={`Average values for ${withPoints.length} signal${withPoints.length === 1 ? '' : 's'}, ${rangeSummary}`}
      >
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={[window.start, window.end]}
            tickFormatter={(value: number) => (isIntraday ? formatTimeOfDay(value) : formatDate(value))}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            fontSize={12}
          />
          <YAxis tickLine={false} axisLine={false} width={56} fontSize={12} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(value) => formatDateTime(Number(value))} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {withPoints.map((entry, index) => (
            <Line
              key={instanceKey(entry.ref)}
              type="monotone"
              dataKey={seriesKey(index)}
              name={seriesKey(index)}
              stroke={`var(--color-${seriesKey(index)})`}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ChartContainer>
      <figcaption className="text-xs text-muted-foreground">
        Average per {window.granularity} bucket · {rangeSummary}
      </figcaption>
    </figure>
  );
}
