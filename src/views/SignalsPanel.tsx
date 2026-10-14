import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { Badge } from '@cognite/aura/components/badge';
import {
  SegmentedControl,
  SegmentedControlButton,
  SegmentedControlList,
} from '@cognite/aura/components/segmented-control';
import { DataGrid } from '@cognite/aura/data-grid';
import type { ColumnDef } from '@tanstack/react-table';
import { Suspense, lazy, useMemo } from 'react';

import { instanceKey } from '../cdm/properties';
import { TIME_WINDOWS, type Signal, type TimeWindowId } from '../domain/asset360Types';
import { NO_VALUE, formatAge, formatReading } from '../domain/format';
import { timeWindowLabel, timeWindowShortLabel } from '../domain/timeWindow';
import type { Asset360ViewModel } from '../hooks/useAsset360ViewModel';

import { PanelBody, PanelSkeleton } from './PanelState';

/**
 * Loaded on demand so the charting library stays out of the initial bundle:
 * the analyst can search and read the tables while it arrives.
 */
const SignalChart = lazy(() =>
  import('./SignalChart').then((module) => ({ default: module.SignalChart }))
);

export function SignalsPanel({ viewModel }: { viewModel: Asset360ViewModel }) {
  const columns = useMemo(() => signalColumns(viewModel.now), [viewModel.now]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">Process signals</h3>
        <WindowSelector value={viewModel.windowId} onChange={viewModel.setWindow} />
      </div>

      <PanelBody
        state={viewModel.signals}
        skeletonLabel="Loading time series"
        skeletonRows={6}
        isEmpty={(result) => result.signals.length === 0}
        emptyTitle="No time series linked to this asset"
        emptyDescription="Nothing in CDF links a time series to this asset, so there are no process signals to show."
      >
        {(result) => (
          <div className="flex flex-col gap-4">
            {result.warnings.map((warning) => (
              <Alert key={warning} variant="warning" alertStyle="strip">
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            ))}

            {viewModel.chart.errorMessage !== undefined ? (
              <Alert variant="warning" alertStyle="strip">
                <AlertDescription>{viewModel.chart.errorMessage}</AlertDescription>
              </Alert>
            ) : viewModel.chart.isLoading ? (
              <PanelSkeleton rows={4} label="Loading chart data" />
            ) : (
              <Suspense fallback={<PanelSkeleton rows={4} label="Loading chart" />}>
                <SignalChart series={viewModel.chart.data ?? []} window={viewModel.timeWindow} />
              </Suspense>
            )}

            <DataGrid
              aria-label="Time series related to this asset"
              data={result.signals}
              columns={columns}
              getRowId={(signal) => instanceKey(signal.ref)}
              size="compact"
              enableSorting
            />
          </div>
        )}
      </PanelBody>
    </div>
  );
}

function WindowSelector({
  value,
  onChange,
}: {
  value: TimeWindowId;
  onChange: (next: TimeWindowId) => void;
}) {
  return (
    <SegmentedControl
      value={value}
      onValueChange={(next: unknown) => {
        const match = TIME_WINDOWS.find((candidate) => candidate === next);
        if (match !== undefined) {
          onChange(match);
        }
      }}
    >
      <SegmentedControlList size="small" aria-label="Chart time window">
        {TIME_WINDOWS.map((id) => (
          <SegmentedControlButton key={id} value={id} aria-label={timeWindowLabel(id)}>
            {timeWindowShortLabel(id)}
          </SegmentedControlButton>
        ))}
      </SegmentedControlList>
    </SegmentedControl>
  );
}

/** Labels for `CogniteTimeSeries.type`, which is an enum on the view. */
const KIND_LABELS: Record<Signal['kind'], string> = {
  numeric: 'Numeric',
  string: 'Text',
  state: 'State',
  unknown: 'Unknown',
};

function signalColumns(now: number): ColumnDef<Signal>[] {
  return [
    {
      id: 'name',
      header: 'Signal',
      accessorFn: (signal) => signal.label,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.original.label}</span>
          {row.original.description !== undefined && (
            <span className="truncate text-xs text-muted-foreground">{row.original.description}</span>
          )}
        </div>
      ),
    },
    {
      id: 'kind',
      header: 'Type',
      accessorFn: (signal) => KIND_LABELS[signal.kind],
      size: 96,
      cell: ({ row }) => <Badge variant="gray">{KIND_LABELS[row.original.kind]}</Badge>,
    },
    {
      id: 'latest',
      header: 'Latest reading',
      accessorFn: (signal) => signal.latest?.value ?? null,
      size: 160,
      cell: ({ row }) => {
        const { latest, unit } = row.original;
        if (latest === undefined) {
          return <span className="text-muted-foreground">No data</span>;
        }
        return (
          <span className="tabular-nums">
            {formatReading(latest.value)}
            {unit !== undefined && <span className="ml-1 text-muted-foreground">{unit}</span>}
          </span>
        );
      },
    },
    {
      id: 'age',
      header: 'Last seen',
      accessorFn: (signal) => signal.latest?.timestamp ?? null,
      size: 128,
      cell: ({ row }) => {
        const { latest } = row.original;
        return (
          <span className="text-muted-foreground">
            {latest === undefined ? NO_VALUE : formatAge(latest.timestamp, now)}
          </span>
        );
      },
    },
  ];
}
