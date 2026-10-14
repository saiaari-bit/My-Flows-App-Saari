import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTimeSeriesPanelViewModel } from './useTimeSeriesPanelViewModel';

import { createTestQueryClient } from '@/__mocks__/queryClient';
import type { TimeSeriesServiceStub } from '@/__mocks__/timeSeriesService';
import {
  createTimeSeriesServiceStub,
  makeTimeSeries,
} from '@/__mocks__/timeSeriesService';
import type { HostAppApi } from '@/host/HostAppContext';
import { HostAppContext } from '@/host/HostAppContext';
import { AppStateProvider } from '@/router/AppStateProvider';
import { CdfServiceError } from '@/services/cdfError';
import {
  DEFAULT_TIME_SERIES_SERVICE_DEPS,
  TimeSeriesServiceContext,
} from '@/services/useTimeSeriesService';

const ASSET = { space: 'my-space', externalId: 'PUMP-001' };
const PRESSURE = { space: 'my-space', externalId: 'PUMP-001:pressure' };
const FLOW = { space: 'my-space', externalId: 'PUMP-001:flow' };
const END = Date.parse('2026-08-27T12:00:00.000Z');

describe(useTimeSeriesPanelViewModel.name, () => {
  let service: TimeSeriesServiceStub;
  let api: HostAppApi;

  beforeEach(() => {
    service = createTimeSeriesServiceStub();
    api = {
      navigateExternal: vi.fn(() => Promise.resolve(true)),
      syncInternalState: vi.fn(() => Promise.resolve(true)),
    };
  });

  it('loads the series linked to the current asset', async () => {
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);

    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.listStatus).toBe('ready'));
    expect(service.getAssetTimeSeries).toHaveBeenCalledWith(ASSET);
    expect(result.current.series[0]?.name).toBe('Discharge pressure');
  });

  it('exposes a loading state while the linked-series read is in flight', () => {
    service.getAssetTimeSeries.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );

    expect(result.current.listStatus).toBe('loading');
  });

  it('exposes an empty successful list', async () => {
    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.listStatus).toBe('ready'));
    expect(result.current.series).toEqual([]);
  });

  it('classifies a linked-series error and retries only when asked', async () => {
    service.getAssetTimeSeries.mockRejectedValueOnce(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );
    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.listStatus).toBe('error'));
    expect(result.current.listErrorKind).toBe('no-access');
    expect(service.getAssetTimeSeries).toHaveBeenCalledTimes(1);

    service.getAssetTimeSeries.mockResolvedValue([makeTimeSeries('PUMP-001:pressure')]);
    act(() => result.current.refreshList());

    await waitFor(() => expect(result.current.listStatus).toBe('ready'));
    expect(service.getAssetTimeSeries).toHaveBeenCalledTimes(2);
  });

  it('starts with no selection and does not request datapoints by default', async () => {
    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.listStatus).toBe('ready'));

    expect(result.current.selectedSeries).toEqual([]);
    expect(result.current.latestStatus).toBe('idle');
    expect(service.getLatestDatapoints).not.toHaveBeenCalled();
  });

  it('host-syncs a user-selected series', async () => {
    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.toggleSeries(PRESSURE));

    expect(result.current.selectedSeries).toEqual([PRESSURE]);
    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ view: 'detail', asset: ASSET, selectedTs: [PRESSURE] })
    );
  });

  it('preserves a deep-linked selection without writing it back to the host', async () => {
    const initialState = JSON.stringify({
      view: 'detail',
      asset: ASSET,
      selectedTs: [PRESSURE],
    });

    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(initialState) }
    );

    await waitFor(() => expect(result.current.latestStatus).toBe('ready'));
    expect(result.current.selectedSeries).toEqual([PRESSURE]);
    expect(api.syncInternalState).not.toHaveBeenCalled();
  });

  it('requests latest datapoints for selected instance ids', async () => {
    service.getLatestDatapoints.mockResolvedValue([
      {
        instanceId: PRESSURE,
        datapoint: { timestamp: 1730000000000, value: 4.2 },
      },
    ]);
    const initialState = JSON.stringify({
      view: 'detail',
      asset: ASSET,
      selectedTs: [PRESSURE],
    });

    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(initialState) }
    );

    await waitFor(() => expect(result.current.latestStatus).toBe('ready'));
    expect(service.getLatestDatapoints).toHaveBeenCalledWith([PRESSURE]);
    expect(result.current.latestDatapoints[0]?.datapoint?.value).toBe(4.2);
  });

  it('reports an empty latest-datapoint response', async () => {
    const initialState = JSON.stringify({
      view: 'detail',
      asset: ASSET,
      selectedTs: [PRESSURE],
    });

    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(initialState) }
    );

    await waitFor(() => expect(result.current.latestStatus).toBe('ready'));
    expect(result.current.latestDatapoints).toEqual([]);
  });

  it('classifies a datapoint error and retries it independently', async () => {
    service.getLatestDatapoints.mockRejectedValueOnce(
      new CdfServiceError('Unavailable', { kind: 'transient', status: 503 })
    );
    const initialState = JSON.stringify({
      view: 'detail',
      asset: ASSET,
      selectedTs: [PRESSURE],
    });
    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(initialState) }
    );
    await waitFor(() => expect(result.current.latestStatus).toBe('error'));
    expect(result.current.latestErrorKind).toBe('transient');

    service.getLatestDatapoints.mockResolvedValue([]);
    act(() => result.current.refreshLatest());

    await waitFor(() => expect(result.current.latestStatus).toBe('ready'));
    expect(service.getLatestDatapoints).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['last24h', 24 * 60 * 60 * 1000],
    ['last7d', 7 * 24 * 60 * 60 * 1000],
    ['last30d', 30 * 24 * 60 * 60 * 1000],
  ] as const)(
    'host-syncs the %s preset and triggers its historical query',
    async (presetKey, duration) => {
      service.getLatestDatapoints.mockResolvedValue([
        { instanceId: PRESSURE, datapoint: { timestamp: END, value: 4.2 } },
      ]);
      const initialState = selectedState(
        presetKey === 'last24h' ? 'last7d' : 'last24h'
      );
      const { result } = renderHook(
        () => useTimeSeriesPanelViewModel(ASSET),
        { wrapper: makeWrapper(initialState) }
      );
      await waitFor(() => expect(result.current.chartStatus).toBe('ready'));
      service.getDatapoints.mockClear();

      act(() => result.current.setRangePreset(presetKey));

      const range = { presetKey, start: END - duration, end: END };
      expect(api.syncInternalState).toHaveBeenCalledWith(
        JSON.stringify({
          view: 'detail',
          asset: ASSET,
          selectedTs: [PRESSURE],
          range,
        })
      );
      await waitFor(() =>
        expect(service.getDatapoints).toHaveBeenCalledWith(
          [PRESSURE],
          range.start,
          range.end + 1
        )
      );
    }
  );

  it('restores an explicit chart range without writing it back to the host', async () => {
    const range = {
      presetKey: 'last7d',
      start: END - 1000,
      end: END,
    } as const;
    const initialState = JSON.stringify({
      view: 'detail',
      asset: ASSET,
      selectedTs: [PRESSURE],
      range,
    });

    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(initialState) }
    );

    await waitFor(() => expect(result.current.chartStatus).toBe('ready'));
    expect(service.getDatapoints).toHaveBeenCalledWith(
      [PRESSURE],
      range.start,
      range.end + 1
    );
    expect(api.syncInternalState).not.toHaveBeenCalled();
  });

  it('exposes successful raw historical datapoints without aggregation', async () => {
    service.getDatapoints.mockResolvedValue([
      {
        instanceId: PRESSURE,
        isString: false,
        unit: 'bar',
        datapoints: [
          { timestamp: END - 1000, value: 4.1 },
          { timestamp: END, value: 4.2 },
        ],
      },
    ]);
    const initialState = selectedState();

    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(initialState) }
    );

    await waitFor(() => expect(result.current.chartStatus).toBe('ready'));
    expect(result.current.chartSeries[0]?.datapoints).toEqual([
      { timestamp: END - 1000, value: 4.1 },
      { timestamp: END, value: 4.2 },
    ]);
  });

  it('exposes an empty historical response', async () => {
    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(selectedState()) }
    );

    await waitFor(() => expect(result.current.chartStatus).toBe('ready'));
    expect(result.current.chartSeries).toEqual([]);
  });

  it('classifies and retries a historical datapoint error', async () => {
    service.getDatapoints.mockRejectedValueOnce(
      new CdfServiceError('Unavailable', { kind: 'transient', status: 503 })
    );
    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(selectedState()) }
    );
    await waitFor(() => expect(result.current.chartStatus).toBe('error'));
    expect(result.current.chartErrorKind).toBe('transient');

    service.getDatapoints.mockResolvedValue([]);
    act(() => result.current.refreshChart());

    await waitFor(() => expect(result.current.chartStatus).toBe('ready'));
    expect(service.getDatapoints).toHaveBeenCalledTimes(2);
  });

  it('does not let an old range response overwrite the current chart', async () => {
    let resolveOld: (
      value: Awaited<ReturnType<TimeSeriesServiceStub['getDatapoints']>>
    ) => void = () => undefined;
    service.getDatapoints
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockResolvedValueOnce([
        {
          instanceId: PRESSURE,
          isString: false,
          datapoints: [{ timestamp: END, value: 7 }],
        },
      ]);
    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(selectedState('last24h')) }
    );
    await waitFor(() => expect(service.getDatapoints).toHaveBeenCalledTimes(1));

    act(() => result.current.setRangePreset('last7d'));
    await waitFor(() => expect(result.current.chartSeries[0]?.datapoints[0]?.value).toBe(7));
    act(() =>
      resolveOld([
        {
          instanceId: PRESSURE,
          isString: false,
          datapoints: [{ timestamp: END, value: 1 }],
        },
      ])
    );

    expect(result.current.chartSeries[0]?.datapoints[0]?.value).toBe(7);
  });

  it('does not let an old series response overwrite the current chart', async () => {
    let resolvePressure: (
      value: Awaited<ReturnType<TimeSeriesServiceStub['getDatapoints']>>
    ) => void = () => undefined;
    service.getDatapoints
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePressure = resolve;
        })
      )
      .mockResolvedValueOnce([
        {
          instanceId: FLOW,
          isString: false,
          datapoints: [{ timestamp: END, value: 10 }],
        },
      ]);
    const { result } = renderHook(
      () => useTimeSeriesPanelViewModel(ASSET),
      { wrapper: makeWrapper(selectedState()) }
    );
    await waitFor(() => expect(service.getDatapoints).toHaveBeenCalledTimes(1));

    act(() => result.current.toggleSeries(PRESSURE));
    act(() => result.current.toggleSeries(FLOW));
    await waitFor(() => expect(result.current.chartSeries[0]?.instanceId).toEqual(FLOW));
    act(() =>
      resolvePressure([
        {
          instanceId: PRESSURE,
          isString: false,
          datapoints: [{ timestamp: END, value: 1 }],
        },
      ])
    );

    expect(result.current.chartSeries[0]?.instanceId).toEqual(FLOW);
  });

  it('does not let an old asset response overwrite the current chart', async () => {
    let resolveOld: (
      value: Awaited<ReturnType<TimeSeriesServiceStub['getDatapoints']>>
    ) => void = () => undefined;
    service.getDatapoints
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockResolvedValueOnce([
        {
          instanceId: PRESSURE,
          isString: false,
          datapoints: [{ timestamp: END, value: 9 }],
        },
      ]);
    const { result, rerender } = renderHook(
      ({ asset }) => useTimeSeriesPanelViewModel(asset),
      {
        initialProps: { asset: ASSET },
        wrapper: makeWrapper(selectedState()),
      }
    );
    await waitFor(() => expect(service.getDatapoints).toHaveBeenCalledTimes(1));

    rerender({ asset: { space: 'my-space', externalId: 'VALVE-9' } });
    await waitFor(() => expect(result.current.chartSeries[0]?.datapoints[0]?.value).toBe(9));
    act(() =>
      resolveOld([
        {
          instanceId: PRESSURE,
          isString: false,
          datapoints: [{ timestamp: END, value: 1 }],
        },
      ])
    );

    expect(result.current.chartSeries[0]?.datapoints[0]?.value).toBe(9);
  });

  it('does not let a late response for an old asset overwrite the current list', async () => {
    let resolveOld: (value: ReturnType<typeof makeTimeSeries>[]) => void = () =>
      undefined;
    service.getAssetTimeSeries
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockResolvedValueOnce([makeTimeSeries('VALVE-9:flow')]);
    const { result, rerender } = renderHook(
      ({ asset }) => useTimeSeriesPanelViewModel(asset),
      { initialProps: { asset: ASSET }, wrapper: makeWrapper() }
    );

    rerender({ asset: { space: 'my-space', externalId: 'VALVE-9' } });
    await waitFor(() => expect(result.current.series[0]?.externalId).toBe('VALVE-9:flow'));
    act(() => resolveOld([makeTimeSeries('PUMP-001:pressure')]));

    expect(result.current.series[0]?.externalId).toBe('VALVE-9:flow');
  });

  function makeWrapper(
    initialState = JSON.stringify({ view: 'detail', asset: ASSET })
  ) {
    const queryClient = createTestQueryClient();
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <TimeSeriesServiceContext.Provider
            value={{
              ...DEFAULT_TIME_SERIES_SERVICE_DEPS,
              useTimeSeriesService: () => service,
            }}
          >
            <HostAppContext.Provider value={{ api, initialState }}>
              <AppStateProvider>{children}</AppStateProvider>
            </HostAppContext.Provider>
          </TimeSeriesServiceContext.Provider>
        </QueryClientProvider>
      );
    };
  }

  function selectedState(presetKey = 'last24h'): string {
    const duration =
      presetKey === 'last30d'
        ? 30 * 24 * 60 * 60 * 1000
        : presetKey === 'last7d'
          ? 7 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
    return JSON.stringify({
      view: 'detail',
      asset: ASSET,
      selectedTs: [PRESSURE],
      range: { presetKey, start: END - duration, end: END },
    });
  }
});
