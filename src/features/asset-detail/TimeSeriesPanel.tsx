import {
  Alert,
  AlertActions,
  AlertButton,
  AlertDescription,
  AlertTitle,
} from '@cognite/aura/components/alert';
import { Badge } from '@cognite/aura/components/badge';
import { Button } from '@cognite/aura/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderEnd,
  CardHeaderStart,
  CardTitle,
} from '@cognite/aura/components/card';
import {
  CheckboxGroup,
  CheckboxItem,
  CheckboxItemControl,
  CheckboxItemDescription,
  CheckboxItemLabel,
} from '@cognite/aura/components/checkbox';
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from '@cognite/aura/components/empty-state';
import { Loader } from '@cognite/aura/components/loader';

import type { ChartSeries } from './chartGeometry';
import { RANGE_PRESET_OPTIONS } from './chartRange';
import { TimeSeriesChart } from './TimeSeriesChart';
import type { TimeSeriesPanelViewModel } from './useTimeSeriesPanelViewModel';
import { useTimeSeriesPanelViewModel } from './useTimeSeriesPanelViewModel';

import type { InstanceRef } from '@/host/hostState';
import type { ServiceErrorKind } from '@/services/cdfError';
import { instanceIdKey } from '@/services/cdm';
import type {
  AssetTimeSeries,
  LatestDatapoint,
} from '@/services/timeSeriesService';

const LIST_ERRORS: Record<ServiceErrorKind, string> = {
  'no-access':
    'You do not have access to read linked time series for this asset.',
  transient: 'The linked time series could not be loaded. Try again in a moment.',
  unknown: 'The linked time series could not be loaded.',
};

const DATAPOINT_ERRORS: Record<ServiceErrorKind, string> = {
  'no-access': 'You do not have access to read datapoints for this selection.',
  transient: 'The latest datapoints could not be loaded. Try again in a moment.',
  unknown: 'The latest datapoints could not be loaded.',
};

export function TimeSeriesPanel({ asset }: { asset: InstanceRef }) {
  const viewModel = useTimeSeriesPanelViewModel(asset);

  return (
    <Card aria-labelledby="time-series-heading">
      <CardHeader>
        <CardHeaderStart>
          <CardTitle as="h2" id="time-series-heading">
            Time series
          </CardTitle>
          <CardDescription>
            Select linked series and inspect their latest values and historical trends.
          </CardDescription>
        </CardHeaderStart>
        <CardHeaderEnd>
          <Button onClick={viewModel.refreshList} size="sm" variant="secondary">
            Refresh
          </Button>
        </CardHeaderEnd>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-6 lg:grid-cols-2">
        <SeriesList viewModel={viewModel} />
        <LatestValues viewModel={viewModel} />
        <HistoricalChart viewModel={viewModel} />
      </CardContent>
    </Card>
  );
}

function SeriesList({ viewModel }: { viewModel: TimeSeriesPanelViewModel }) {
  if (viewModel.listStatus === 'loading') {
    return <Loading label="Loading linked time series..." />;
  }

  if (viewModel.listStatus === 'error') {
    return (
      <PanelError
        description={LIST_ERRORS[viewModel.listErrorKind ?? 'unknown']}
        onRetry={viewModel.refreshList}
        title="Could not load time series"
      />
    );
  }

  if (viewModel.series.length === 0) {
    return (
      <EmptyState type="no-results">
        <EmptyStateTitle as="h3">No linked time series</EmptyStateTitle>
        <EmptyStateDescription>
          This asset has no CogniteTimeSeries instances linked through its assets
          relation.
        </EmptyStateDescription>
      </EmptyState>
    );
  }

  return (
    <CheckboxGroup aria-label="Linked time series" orientation="vertical">
      {viewModel.series.map((series) => (
        <SeriesOption
          checked={viewModel.isSelected(series)}
          key={instanceIdKey(series)}
          onToggle={() => viewModel.toggleSeries(series)}
          series={series}
        />
      ))}
    </CheckboxGroup>
  );
}

function SeriesOption({
  checked,
  onToggle,
  series,
}: {
  checked: boolean;
  onToggle: () => void;
  series: AssetTimeSeries;
}) {
  return (
    <CheckboxItem variant="card">
      <CheckboxItemControl checked={checked} onCheckedChange={onToggle} />
      <span className="min-w-0">
        <CheckboxItemLabel>{series.name ?? series.externalId}</CheckboxItemLabel>
        <CheckboxItemDescription>
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate">{series.externalId}</span>
            {series.sourceUnit !== undefined && (
              <Badge background variant="mountain">
                {series.sourceUnit}
              </Badge>
            )}
          </span>
        </CheckboxItemDescription>
      </span>
    </CheckboxItem>
  );
}

function HistoricalChart({ viewModel }: { viewModel: TimeSeriesPanelViewModel }) {
  if (viewModel.chartStatus === 'idle') {
    return (
      <div className="lg:col-span-2">
        <EmptyState type="new-object">
          <EmptyStateTitle as="h3">Select a time series to chart</EmptyStateTitle>
          <EmptyStateDescription>
            Historical datapoints are loaded only after an explicit selection.
          </EmptyStateDescription>
        </EmptyState>
      </div>
    );
  }

  const chartSeries = toChartSeries(viewModel);
  const hasPoints = chartSeries.some((series) =>
    series.points.some((point) => point.value !== null)
  );

  return (
    <section aria-labelledby="historical-chart-heading" className="min-w-0 lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-medium" id="historical-chart-heading">
            Historical trend
          </h3>
          {viewModel.chartStatus === 'ready' && (
            <Button onClick={viewModel.refreshChart} size="sm" variant="ghost">
              Refresh chart
            </Button>
          )}
        </div>
        <div aria-label="Chart time range" className="flex flex-wrap gap-2" role="group">
          {RANGE_PRESET_OPTIONS.map((option) => (
            <Button
              aria-pressed={viewModel.rangePreset === option.key}
              disabled={!viewModel.canChangeRange}
              key={option.key}
              onClick={() => viewModel.setRangePreset(option.key)}
              size="sm"
              variant={viewModel.rangePreset === option.key ? 'default' : 'secondary'}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {viewModel.chartStatus === 'loading' && (
        <Loading label="Loading historical datapoints..." />
      )}

      {viewModel.chartStatus === 'error' && (
        <PanelError
          description={DATAPOINT_ERRORS[viewModel.chartErrorKind ?? 'unknown']}
          onRetry={viewModel.refreshChart}
          title="Could not load historical datapoints"
        />
      )}

      {viewModel.chartStatus === 'ready' &&
        (viewModel.range === undefined || !hasPoints) && (
          <EmptyState type="no-results">
            <EmptyStateTitle as="h4">No historical datapoints</EmptyStateTitle>
            <EmptyStateDescription>
              The selected time series have no numeric datapoints in this range.
            </EmptyStateDescription>
          </EmptyState>
        )}

      {viewModel.chartStatus === 'ready' &&
        viewModel.range !== undefined &&
        hasPoints && (
          <TimeSeriesChart
            end={viewModel.range.end}
            series={chartSeries}
            start={viewModel.range.start}
          />
        )}
    </section>
  );
}

function toChartSeries(viewModel: TimeSeriesPanelViewModel): ChartSeries[] {
  return viewModel.chartSeries.map((series, index) => {
    const externalId =
      series.instanceId?.externalId ??
      series.externalId ??
      `series-${index + 1}`;
    const space = series.instanceId?.space;
    const metadata = viewModel.series.find(
      (candidate) =>
        candidate.externalId === externalId &&
        (space === undefined || candidate.space === space)
    );
    return {
      id: space === undefined ? externalId : `${space}:${externalId}`,
      label: metadata?.name ?? externalId,
      unit: series.unit ?? metadata?.sourceUnit,
      points: series.datapoints.map((point) => ({
        timestamp: point.timestamp,
        value:
          typeof point.value === 'number' && Number.isFinite(point.value)
            ? point.value
            : null,
      })),
    };
  });
}

function LatestValues({ viewModel }: { viewModel: TimeSeriesPanelViewModel }) {
  if (viewModel.latestStatus === 'idle') {
    return (
      <EmptyState type="new-object">
        <EmptyStateTitle as="h3">Select a time series</EmptyStateTitle>
        <EmptyStateDescription>
          No series is selected. Select one or more series to load their latest
          datapoints.
        </EmptyStateDescription>
      </EmptyState>
    );
  }

  if (viewModel.latestStatus === 'loading') {
    return <Loading label="Loading latest datapoints..." />;
  }

  if (viewModel.latestStatus === 'error') {
    return (
      <PanelError
        description={DATAPOINT_ERRORS[viewModel.latestErrorKind ?? 'unknown']}
        onRetry={viewModel.refreshLatest}
        title="Could not load latest datapoints"
      />
    );
  }

  const datapoints = viewModel.latestDatapoints.filter(
    (series) => series.datapoint !== null
  );
  if (datapoints.length === 0) {
    return (
      <EmptyState type="no-results">
        <EmptyStateTitle as="h3">No datapoints</EmptyStateTitle>
        <EmptyStateDescription>
          The selected time series do not have any datapoints yet.
        </EmptyStateDescription>
      </EmptyState>
    );
  }

  return (
    <section aria-labelledby="latest-values-heading" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium" id="latest-values-heading">
          Latest values
        </h3>
        <Button onClick={viewModel.refreshLatest} size="sm" variant="ghost">
          Refresh values
        </Button>
      </div>
      <dl className="flex flex-col gap-3">
        {datapoints.map((series, index) => (
          <LatestValue
            key={seriesKey(series, index)}
            series={series}
          />
        ))}
      </dl>
    </section>
  );
}

function LatestValue({ series }: { series: LatestDatapoint }) {
  const label =
    series.instanceId?.externalId ?? series.externalId ?? 'Time series';
  const datapoint = series.datapoint;
  if (datapoint === null) return null;

  return (
    <div className="min-w-0 rounded-md border p-3">
      <dt className="truncate text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-lg font-medium">{datapoint.value}</dd>
      <dd className="text-xs text-muted-foreground">
        <time dateTime={new Date(datapoint.timestamp).toISOString()}>
          {new Date(datapoint.timestamp).toISOString()}
        </time>
      </dd>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-3 text-muted-foreground"
      role="status"
    >
      <Loader size={20} />
      <span>{label}</span>
    </div>
  );
}

function PanelError({
  description,
  onRetry,
  title,
}: {
  description: string;
  onRetry: () => void;
  title: string;
}) {
  return (
    <Alert alertStyle="card" variant="error">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <AlertActions>
        <AlertButton onClick={onRetry} type="button">
          Try again
        </AlertButton>
      </AlertActions>
    </Alert>
  );
}

function seriesKey(series: LatestDatapoint, index: number): string {
  if (series.instanceId !== undefined) return instanceIdKey(series.instanceId);
  return series.externalId ?? `latest-${index}`;
}
