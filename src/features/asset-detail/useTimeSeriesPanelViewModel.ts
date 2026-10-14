import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  latestDatapointAnchor,
  resolveChartRange,
} from './chartRange';
import type { ResolvedChartRange } from './chartRange';

import type { InstanceRef , TimeRangePreset } from '@/host/hostState';
import { instanceRefEquals } from '@/host/hostState';
import { useAppRoute } from '@/router/useAppRoute';
import type { ServiceErrorKind } from '@/services/cdfError';
import { toCdfServiceError } from '@/services/cdfError';
import { instanceIdKey } from '@/services/cdm';
import type {
  AssetTimeSeries,
  LatestDatapoint,
  SeriesDatapoints,
} from '@/services/timeSeriesService';
import { useTimeSeriesService } from '@/services/useTimeSeriesService';

export type PanelStatus = 'loading' | 'ready' | 'error';

export type TimeSeriesPanelViewModel = {
  listStatus: PanelStatus;
  series: AssetTimeSeries[];
  listErrorKind?: ServiceErrorKind;
  selectedSeries: InstanceRef[];
  latestStatus: 'idle' | PanelStatus;
  latestDatapoints: LatestDatapoint[];
  latestErrorKind?: ServiceErrorKind;
  rangePreset: TimeRangePreset;
  range?: ResolvedChartRange;
  canChangeRange: boolean;
  chartStatus: 'idle' | PanelStatus;
  chartSeries: SeriesDatapoints[];
  chartErrorKind?: ServiceErrorKind;
  toggleSeries: (series: InstanceRef) => void;
  isSelected: (series: InstanceRef) => boolean;
  setRangePreset: (preset: TimeRangePreset) => void;
  refreshList: () => void;
  refreshLatest: () => void;
  refreshChart: () => void;
};

/**
 * Server state stays in TanStack Query; only selected identities live in the
 * host route. Query keys include the asset/series identities, so an old
 * response is cached under its old key and can never overwrite the current
 * screen.
 */
export function useTimeSeriesPanelViewModel(
  assetId: InstanceRef
): TimeSeriesPanelViewModel {
  const service = useTimeSeriesService();
  const route = useAppRoute();
  const selectedSeries = useMemo(
    () => route.state.selectedTs ?? [],
    [route.state.selectedTs]
  );
  const { setTimeRange, toggleTimeSeries } = route;
  const { space, externalId } = assetId;

  const listQuery = useQuery({
    queryKey: ['asset-time-series', space, externalId],
    queryFn: () => service.getAssetTimeSeries({ space, externalId }),
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const selectionKey = selectedSeries.map(instanceIdKey).sort();
  const latestQuery = useQuery({
    queryKey: ['latest-datapoints', ...selectionKey],
    queryFn: () =>
      service.getLatestDatapoints(
        selectedSeries.map((series) => ({
          space: series.space,
          externalId: series.externalId,
        }))
      ),
    enabled: selectedSeries.length > 0,
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
  const latestAnchor = latestDatapointAnchor(latestQuery.data ?? []);
  const range = resolveChartRange(route.state.range, latestAnchor);
  const rangeStart = range?.start;
  const rangeEnd = range?.end;
  const historyQuery = useQuery({
    queryKey: [
      'historical-datapoints',
      space,
      externalId,
      ...selectionKey,
      rangeStart,
      rangeEnd,
    ],
    queryFn: () => {
      if (rangeStart === undefined || rangeEnd === undefined) {
        return Promise.resolve([]);
      }
      /*
       * CDF's end bound is exclusive. Add one millisecond to include a latest
       * datapoint exactly on the visible right edge without changing the
       * host-synced range itself.
       */
      return service.getDatapoints(
        selectedSeries.map((series) => ({
          space: series.space,
          externalId: series.externalId,
        })),
        rangeStart,
        rangeEnd + 1
      );
    },
    enabled: selectedSeries.length > 0 && range !== undefined,
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const toggleSeries = useCallback(
    (series: InstanceRef) =>
      toggleTimeSeries({
        space: series.space,
        externalId: series.externalId,
      }),
    [toggleTimeSeries]
  );

  const isSelected = useCallback(
    (series: InstanceRef) =>
      selectedSeries.some((selected) => instanceRefEquals(selected, series)),
    [selectedSeries]
  );

  const setRangePreset = useCallback(
    (preset: TimeRangePreset) => {
      const end = latestAnchor ?? range?.end;
      const resolved = resolveChartRange({ presetKey: preset, end }, end);
      if (resolved !== undefined) setTimeRange(resolved);
    },
    [latestAnchor, range?.end, setTimeRange]
  );

  const refetchList = listQuery.refetch;
  const refetchLatest = latestQuery.refetch;
  const refetchHistory = historyQuery.refetch;
  const refreshList = useCallback(() => void refetchList(), [refetchList]);
  const refreshLatest = useCallback(
    () => void refetchLatest(),
    [refetchLatest]
  );
  const refreshChart = useCallback(() => {
    if (range === undefined) {
      void refetchLatest();
      return;
    }
    void refetchHistory();
  }, [range, refetchHistory, refetchLatest]);
  const chartStatus = resolveChartStatus(
    selectedSeries.length,
    range,
    latestQuery.status,
    historyQuery.status
  );
  const chartError =
    range === undefined ? latestQuery.error : historyQuery.error;

  return useMemo(
    () => ({
      listStatus: toPanelStatus(listQuery.status),
      series: listQuery.data ?? [],
      listErrorKind:
        listQuery.error === null
          ? undefined
          : toCdfServiceError(listQuery.error).kind,
      selectedSeries,
      latestStatus:
        selectedSeries.length === 0 ? 'idle' : toPanelStatus(latestQuery.status),
      latestDatapoints: latestQuery.data ?? [],
      latestErrorKind:
        latestQuery.error === null
          ? undefined
          : toCdfServiceError(latestQuery.error).kind,
      rangePreset: range?.presetKey ?? route.state.range?.presetKey ?? 'last24h',
      range,
      canChangeRange: latestAnchor !== undefined || range !== undefined,
      chartStatus,
      chartSeries: historyQuery.data ?? [],
      chartErrorKind:
        chartError === null ? undefined : toCdfServiceError(chartError).kind,
      toggleSeries,
      isSelected,
      setRangePreset,
      refreshList,
      refreshLatest,
      refreshChart,
    }),
    [
      listQuery.status,
      listQuery.data,
      listQuery.error,
      selectedSeries,
      latestQuery.status,
      latestQuery.data,
      latestQuery.error,
      range,
      route.state.range?.presetKey,
      latestAnchor,
      chartStatus,
      historyQuery.data,
      chartError,
      toggleSeries,
      isSelected,
      setRangePreset,
      refreshList,
      refreshLatest,
      refreshChart,
    ]
  );
}

function resolveChartStatus(
  selectionCount: number,
  range: ResolvedChartRange | undefined,
  latestStatus: 'pending' | 'error' | 'success',
  historyStatus: 'pending' | 'error' | 'success'
): 'idle' | PanelStatus {
  if (selectionCount === 0) return 'idle';
  if (range === undefined) {
    if (latestStatus === 'pending') return 'loading';
    return latestStatus === 'error' ? 'error' : 'ready';
  }
  return toPanelStatus(historyStatus);
}

function toPanelStatus(status: 'pending' | 'error' | 'success'): PanelStatus {
  if (status === 'pending') return 'loading';
  return status === 'error' ? 'error' : 'ready';
}
