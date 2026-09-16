import { Badge } from '@cognite/aura/components/badge';
import { DataGrid } from '@cognite/aura/data-grid';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

import { instanceKey } from '../cdm/properties';
import type { WorkOrder, WorkOrderStatus } from '../domain/asset360Types';
import { formatDateTime } from '../domain/format';
import { workOrderStatusLabel } from '../domain/workOrderStatus';
import type { Asset360ViewModel } from '../hooks/useAsset360ViewModel';

import { PanelBody } from './PanelState';

export function WorkOrdersPanel({ viewModel }: { viewModel: Asset360ViewModel }) {
  const columns = useMemo(() => workOrderColumns(), []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Work orders and activities</h3>
        <p className="text-xs text-muted-foreground">
          Newest first. Status is derived from the recorded and planned times.
        </p>
      </div>

      <PanelBody
        state={viewModel.workOrders}
        skeletonLabel="Loading work orders"
        skeletonRows={6}
        isEmpty={(orders) => orders.length === 0}
        emptyTitle="No work orders linked to this asset"
        emptyDescription="Nothing in CDF links an activity to this asset, so there is no maintenance history to show."
      >
        {(orders) => (
          <DataGrid
            aria-label="Work orders related to this asset"
            data={orders}
            columns={columns}
            getRowId={(order) => instanceKey(order.ref)}
            size="compact"
            enableSorting
          />
        )}
      </PanelBody>
    </div>
  );
}

/**
 * Status colour plus its text label, so the state is never carried by colour
 * alone.
 */
const STATUS_VARIANT: Record<WorkOrderStatus, 'success' | 'inProgress' | 'gray' | 'warning'> = {
  completed: 'success',
  inProgress: 'inProgress',
  planned: 'gray',
  unknown: 'warning',
};

function workOrderColumns(): ColumnDef<WorkOrder>[] {
  return [
    {
      id: 'name',
      header: 'Work order',
      accessorFn: (order) => order.label,
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
      id: 'status',
      header: 'Status',
      accessorFn: (order) => workOrderStatusLabel(order.status),
      size: 128,
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]} dot>
          {workOrderStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      id: 'start',
      header: 'Start',
      accessorFn: (order) => order.startTime ?? order.scheduledStartTime ?? null,
      size: 168,
      cell: ({ row }) => <TimeCell actual={row.original.startTime} planned={row.original.scheduledStartTime} />,
    },
    {
      id: 'end',
      header: 'End',
      accessorFn: (order) => order.endTime ?? order.scheduledEndTime ?? null,
      size: 168,
      cell: ({ row }) => <TimeCell actual={row.original.endTime} planned={row.original.scheduledEndTime} />,
    },
    {
      id: 'sourceId',
      header: 'Source id',
      accessorFn: (order) => order.sourceId ?? '',
      size: 140,
      cell: ({ row }) => (
        <span className="truncate font-mono text-xs text-muted-foreground">{row.original.sourceId ?? '—'}</span>
      ),
    },
  ];
}

/** Shows the recorded time, or the planned time clearly marked as planned. */
function TimeCell({ actual, planned }: { actual: number | undefined; planned: number | undefined }) {
  if (actual !== undefined) {
    return <span className="tabular-nums">{formatDateTime(actual)}</span>;
  }
  if (planned !== undefined) {
    return (
      <span className="tabular-nums text-muted-foreground">
        {formatDateTime(planned)} <span className="text-xs">(planned)</span>
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}
