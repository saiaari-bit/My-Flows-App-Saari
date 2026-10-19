import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeSeriesPanel } from './TimeSeriesPanel';

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
const END = Date.parse('2026-08-27T12:00:00.000Z');

describe(TimeSeriesPanel.name, () => {
  let service: TimeSeriesServiceStub;
  let api: HostAppApi;

  beforeEach(() => {
    service = createTimeSeriesServiceStub();
    api = {
      navigateExternal: vi.fn(() => Promise.resolve(true)),
      syncInternalState: vi.fn(() => Promise.resolve(true)),
    };
  });

  it('shows an independent loading state for the linked-series list', () => {
    service.getAssetTimeSeries.mockReturnValue(new Promise(() => undefined));

    renderPanel();

    expect(screen.getByText('Loading linked time series...')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Select a time series' })).toBeInTheDocument();
  });

  it('renders linked series returned by the service', async () => {
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', {
        name: 'Discharge pressure',
        sourceUnit: 'bar',
      }),
      makeTimeSeries('PUMP-001:temperature', { name: 'Bearing temperature' }),
    ]);

    renderPanel();

    expect(await screen.findByRole('checkbox', { name: /discharge pressure/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /bearing temperature/i })).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('shows an empty state when the asset has no linked series', async () => {
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'No linked time series' })).toBeInTheDocument();
  });

  it('retries a failed list without replacing the rest of the panel', async () => {
    service.getAssetTimeSeries.mockRejectedValueOnce(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );
    renderPanel();
    expect(await screen.findByText('Could not load time series')).toBeInTheDocument();
    expect(screen.getByText(/do not have access to read linked time series/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Select a time series' })).toBeInTheDocument();

    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('checkbox', { name: /discharge pressure/i })).toBeInTheDocument();
  });

  it('selects a series and synchronizes only its identity to host state', async () => {
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    renderPanel();

    await userEvent.click(
      await screen.findByRole('checkbox', { name: /discharge pressure/i })
    );

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ view: 'detail', asset: ASSET, selectedTs: [PRESSURE] })
    );
    expect(service.getLatestDatapoints).toHaveBeenCalledWith([PRESSURE]);
  });

  it('restores a deep-linked selection without synchronizing during restoration', async () => {
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    renderPanel(
      JSON.stringify({ view: 'detail', asset: ASSET, selectedTs: [PRESSURE] })
    );

    expect(
      await screen.findByRole('checkbox', { name: /discharge pressure/i })
    ).toBeChecked();
    await waitFor(() => expect(service.getLatestDatapoints).toHaveBeenCalledWith([PRESSURE]));
    expect(api.syncInternalState).not.toHaveBeenCalled();
  });

  it('shows a loading state while latest datapoints are in flight', () => {
    service.getLatestDatapoints.mockReturnValue(new Promise(() => undefined));

    renderPanel(
      JSON.stringify({ view: 'detail', asset: ASSET, selectedTs: [PRESSURE] })
    );

    expect(screen.getByText('Loading latest datapoints...')).toBeInTheDocument();
  });

  it('shows the latest value and timestamp for a selected series', async () => {
    service.getLatestDatapoints.mockResolvedValue([
      {
        instanceId: PRESSURE,
        datapoint: { timestamp: 1730000000000, value: 4.2 },
      },
    ]);
    renderPanel(
      JSON.stringify({ view: 'detail', asset: ASSET, selectedTs: [PRESSURE] })
    );

    expect(await screen.findByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('2024-10-27T03:33:20.000Z')).toBeInTheDocument();
  });

  it('shows an empty state when selected series have no datapoints', async () => {
    service.getLatestDatapoints.mockResolvedValue([
      { instanceId: PRESSURE, datapoint: null },
    ]);
    renderPanel(
      JSON.stringify({ view: 'detail', asset: ASSET, selectedTs: [PRESSURE] })
    );

    expect(await screen.findByRole('heading', { name: 'No datapoints' })).toBeInTheDocument();
  });

  it('shows and retries a datapoint error independently from the list', async () => {
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    service.getLatestDatapoints.mockRejectedValueOnce(
      new CdfServiceError('Unavailable', { kind: 'transient', status: 503 })
    );
    renderPanel(
      JSON.stringify({ view: 'detail', asset: ASSET, selectedTs: [PRESSURE] })
    );
    expect(await screen.findByText('Could not load latest datapoints')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /discharge pressure/i })).toBeInTheDocument();

    service.getLatestDatapoints.mockResolvedValue([
      {
        instanceId: PRESSURE,
        datapoint: { timestamp: 1730000000000, value: 4.2 },
      },
    ]);
    const [retryLatest] = screen.getAllByRole('button', { name: 'Try again' });
    if (retryLatest === undefined) throw new Error('Expected a retry action');
    await userEvent.click(retryLatest);

    expect(await screen.findByText('4.2')).toBeInTheDocument();
  });

  it('loads and displays historical data after an explicit selection', async () => {
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', {
        name: 'Discharge pressure',
        sourceUnit: 'bar',
      }),
    ]);
    service.getLatestDatapoints.mockResolvedValue([
      { instanceId: PRESSURE, datapoint: { timestamp: END, value: 4.2 } },
    ]);
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
    renderPanel();

    await userEvent.click(
      await screen.findByRole('checkbox', { name: /discharge pressure/i })
    );

    expect(
      await screen.findByRole('img', {
        name: 'Historical trend for Discharge pressure',
      })
    ).toBeInTheDocument();
    expect(service.getDatapoints).toHaveBeenCalledWith(
      [PRESSURE],
      END - 24 * 60 * 60 * 1000,
      END + 1
    );
  });

  it('changing the range updates host state and the displayed chart window', async () => {
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    service.getDatapoints.mockResolvedValue([
      {
        instanceId: PRESSURE,
        isString: false,
        datapoints: [{ timestamp: END, value: 4.2 }],
      },
    ]);
    const start = END - 24 * 60 * 60 * 1000;
    renderPanel(
      JSON.stringify({
        view: 'detail',
        asset: ASSET,
        selectedTs: [PRESSURE],
        range: { presetKey: 'last24h', start, end: END },
      })
    );
    await screen.findByRole('img', { name: /historical trend/i });

    await userEvent.click(screen.getByRole('button', { name: '7 days' }));

    const range = {
      presetKey: 'last7d',
      start: END - 7 * 24 * 60 * 60 * 1000,
      end: END,
    };
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
  });

  it('refreshes the historical chart on demand without changing selection, range, or host state', async () => {
    // Arrange
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    service.getDatapoints.mockResolvedValueOnce([
      {
        instanceId: PRESSURE,
        isString: false,
        datapoints: [{ timestamp: END, value: 4.2 }],
      },
    ]);
    const start = END - 24 * 60 * 60 * 1000;
    renderPanel(
      JSON.stringify({
        view: 'detail',
        asset: ASSET,
        selectedTs: [PRESSURE],
        range: { presetKey: 'last24h', start, end: END },
      })
    );
    await screen.findByRole('img', { name: /historical trend/i });
    expect(service.getDatapoints).toHaveBeenCalledTimes(1);

    // Act
    service.getDatapoints.mockResolvedValueOnce([
      {
        instanceId: PRESSURE,
        isString: false,
        datapoints: [{ timestamp: END, value: 5.5 }],
      },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh chart' }));

    // Assert
    await waitFor(() => expect(service.getDatapoints).toHaveBeenCalledTimes(2));
    expect(service.getDatapoints).toHaveBeenNthCalledWith(2, [PRESSURE], start, END + 1);
    expect(screen.getByRole('checkbox', { name: /discharge pressure/i })).toBeChecked();
    expect(screen.getByRole('button', { name: '24 hours' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(api.syncInternalState).not.toHaveBeenCalled();
  });

  it('shows an error when refreshing the chart fails, keeping the prior selection and range', async () => {
    // Arrange
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    service.getDatapoints.mockResolvedValueOnce([
      {
        instanceId: PRESSURE,
        isString: false,
        datapoints: [{ timestamp: END, value: 4.2 }],
      },
    ]);
    const start = END - 24 * 60 * 60 * 1000;
    renderPanel(
      JSON.stringify({
        view: 'detail',
        asset: ASSET,
        selectedTs: [PRESSURE],
        range: { presetKey: 'last24h', start, end: END },
      })
    );
    await screen.findByRole('img', { name: /historical trend/i });

    // Act
    service.getDatapoints.mockRejectedValueOnce(
      new CdfServiceError('Unavailable', { kind: 'transient', status: 503 })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh chart' }));

    // Assert
    expect(
      await screen.findByText('Could not load historical datapoints')
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /discharge pressure/i })).toBeChecked();
  });

  it('does not refetch the linked-series list when only the chart is refreshed', async () => {
    // Arrange
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    service.getDatapoints.mockResolvedValue([
      {
        instanceId: PRESSURE,
        isString: false,
        datapoints: [{ timestamp: END, value: 4.2 }],
      },
    ]);
    const start = END - 24 * 60 * 60 * 1000;
    renderPanel(
      JSON.stringify({
        view: 'detail',
        asset: ASSET,
        selectedTs: [PRESSURE],
        range: { presetKey: 'last24h', start, end: END },
      })
    );
    await screen.findByRole('img', { name: /historical trend/i });
    expect(service.getAssetTimeSeries).toHaveBeenCalledTimes(1);

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Refresh chart' }));
    await waitFor(() => expect(service.getDatapoints).toHaveBeenCalledTimes(2));

    // Assert
    expect(service.getAssetTimeSeries).toHaveBeenCalledTimes(1);
  });

  it('shows and retries a historical chart error without hiding the series list', async () => {
    service.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    service.getDatapoints.mockRejectedValueOnce(
      new CdfServiceError('Unavailable', { kind: 'transient', status: 503 })
    );
    const start = END - 24 * 60 * 60 * 1000;
    renderPanel(
      JSON.stringify({
        view: 'detail',
        asset: ASSET,
        selectedTs: [PRESSURE],
        range: { presetKey: 'last24h', start, end: END },
      })
    );

    expect(
      await screen.findByText('Could not load historical datapoints')
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /discharge pressure/i })).toBeInTheDocument();

    service.getDatapoints.mockResolvedValue([
      {
        instanceId: PRESSURE,
        isString: false,
        datapoints: [{ timestamp: END, value: 4.2 }],
      },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('img', { name: /historical trend/i })).toBeInTheDocument();
  });

  function renderPanel(initialState = JSON.stringify({ view: 'detail', asset: ASSET })) {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <TimeSeriesServiceContext.Provider
          value={{
            ...DEFAULT_TIME_SERIES_SERVICE_DEPS,
            useTimeSeriesService: () => service,
          }}
        >
          <HostAppContext.Provider value={{ api, initialState }}>
            <AppStateProvider>
              <TimeSeriesPanel asset={ASSET} />
            </AppStateProvider>
          </HostAppContext.Provider>
        </TimeSeriesServiceContext.Provider>
      </QueryClientProvider>
    );
  }
});
