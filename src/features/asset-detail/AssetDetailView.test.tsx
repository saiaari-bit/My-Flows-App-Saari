import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssetDetailView } from './AssetDetailView';

import type { ActivityServiceStub } from '@/__mocks__/activityService';
import {
  createActivityServiceStub,
  makeActivity,
} from '@/__mocks__/activityService';
import type { AssetServiceStub } from '@/__mocks__/assetService';
import { createAssetServiceStub, makeAsset } from '@/__mocks__/assetService';
import type { FileServiceStub } from '@/__mocks__/fileService';
import { createFileServiceStub, makeFile } from '@/__mocks__/fileService';
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
  ActivityServiceContext,
  DEFAULT_ACTIVITY_SERVICE_DEPS,
} from '@/services/useActivityService';
import { AssetServiceContext, DEFAULT_ASSET_SERVICE_DEPS } from '@/services/useAssetService';
import {
  DEFAULT_FILE_SERVICE_DEPS,
  FileServiceContext,
} from '@/services/useFileService';
import {
  DEFAULT_TIME_SERIES_SERVICE_DEPS,
  TimeSeriesServiceContext,
} from '@/services/useTimeSeriesService';

const ASSET_ID = { space: 'my-space', externalId: 'PUMP-001' };

describe(AssetDetailView.name, () => {
  let assetService: AssetServiceStub;
  let activityService: ActivityServiceStub;
  let fileService: FileServiceStub;
  let timeSeriesService: TimeSeriesServiceStub;
  let onBack: () => void;
  let api: HostAppApi;

  beforeEach(() => {
    assetService = createAssetServiceStub();
    activityService = createActivityServiceStub();
    fileService = createFileServiceStub();
    timeSeriesService = createTimeSeriesServiceStub();
    onBack = vi.fn();
    api = {
      navigateExternal: vi.fn(() => Promise.resolve(true)),
      syncInternalState: vi.fn(() => Promise.resolve(true)),
    };
  });

  it('identifies the asset from the route while it loads', () => {
    assetService.getAsset.mockReturnValue(new Promise(() => undefined));

    renderDetailView();

    expect(screen.getByRole('heading', { name: 'PUMP-001' })).toBeInTheDocument();
    expect(screen.getByText('my-space')).toBeInTheDocument();
    expect(screen.getByText('Loading asset...')).toBeInTheDocument();
  });

  it('shows the name, tag and description of the retrieved asset', async () => {
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', { name: 'Feed water pump', description: 'Boiler feed water pump' })
    );

    renderDetailView();

    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    expect(screen.getByText('Plant tag')).toBeInTheDocument();
    expect(screen.getByText('PUMP-001')).toBeInTheDocument();
    expect(screen.getByText('Boiler feed water pump')).toBeInTheDocument();
  });

  it('shows verified asset hierarchy context without treating CDM tags as the plant tag', async () => {
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', {
        name: 'Feed water pump',
        path: [
          { space: 'my-space', externalId: 'PLANT' },
          { space: 'my-space', externalId: 'AREA-A' },
        ],
      })
    );

    renderDetailView();

    const hierarchy = await screen.findByRole('navigation', { name: 'Asset hierarchy' });
    expect(hierarchy).toHaveTextContent('PLANT');
    expect(hierarchy).toHaveTextContent('AREA-A');
    expect(hierarchy).toHaveTextContent('PUMP-001');
  });

  it('says so when the asset carries no description', async () => {
    assetService.getAsset.mockResolvedValue(makeAsset('PUMP-001', { name: 'Feed water pump' }));

    renderDetailView();

    expect(await screen.findByText('This asset has no description.')).toBeInTheDocument();
  });

  it('explains a deep link that points at a deleted asset', async () => {
    assetService.getAsset.mockResolvedValue(null);

    renderDetailView();

    expect(await screen.findByText('Asset not found')).toBeInTheDocument();
    expect(screen.getByText(/no longer exists in my-space/)).toBeInTheDocument();
  });

  it('explains a failed read and re-reads when the user retries', async () => {
    // Arrange
    assetService.getAsset.mockRejectedValueOnce(
      new CdfServiceError('Service unavailable', { kind: 'transient', status: 503 })
    );
    renderDetailView();
    expect(await screen.findByText('Could not load this asset')).toBeInTheDocument();
    expect(screen.getByText(/timed out or was throttled/i)).toBeInTheDocument();

    // Act
    assetService.getAsset.mockResolvedValue(makeAsset('PUMP-001', { name: 'Feed water pump' }));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    expect(screen.queryByText('Could not load this asset')).not.toBeInTheDocument();
  });

  it('names the missing capability when the user cannot read the asset', async () => {
    assetService.getAsset.mockRejectedValue(
      new CdfServiceError('Insufficient access rights', { kind: 'no-access', status: 403 })
    );

    renderDetailView();

    expect(await screen.findByText(/do not have access to read this asset/i)).toBeInTheDocument();
  });

  it('keeps a successful header visible when the time-series panel fails', async () => {
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', {
        name: 'Feed water pump',
        description: 'Boiler feed water pump',
      })
    );
    timeSeriesService.getAssetTimeSeries.mockRejectedValue(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );
    activityService.getAssetActivities.mockResolvedValue([
      makeActivity('WO-1', { name: 'Replace mechanical seal' }),
    ]);

    renderDetailView();

    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    expect(screen.getByText('Boiler feed water pump')).toBeInTheDocument();
    expect(await screen.findByText('Could not load time series')).toBeInTheDocument();
    expect(await screen.findByText('Replace mechanical seal')).toBeInTheDocument();
  });

  it('keeps the header and time-series panel visible when activities fail', async () => {
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', { name: 'Feed water pump' })
    );
    timeSeriesService.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    activityService.getAssetActivities.mockRejectedValue(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );

    renderDetailView();

    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    expect(
      await screen.findByRole('checkbox', { name: /discharge pressure/i })
    ).toBeInTheDocument();
    expect(await screen.findByText('Could not load activities')).toBeInTheDocument();
  });

  it('keeps the header, time series, and activities visible when documents fail', async () => {
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', { name: 'Feed water pump' })
    );
    timeSeriesService.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    activityService.getAssetActivities.mockResolvedValue([
      makeActivity('WO-1', { name: 'Replace mechanical seal' }),
    ]);
    fileService.getAssetFiles.mockRejectedValue(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );

    renderDetailView();

    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    expect(
      await screen.findByRole('checkbox', { name: /discharge pressure/i })
    ).toBeInTheDocument();
    expect(await screen.findByText('Replace mechanical seal')).toBeInTheDocument();
    expect(await screen.findByText('Could not load documents')).toBeInTheDocument();
  });

  it('keeps the other detail panels visible when the historical chart fails', async () => {
    const end = Date.parse('2026-08-27T12:00:00.000Z');
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', { name: 'Feed water pump' })
    );
    timeSeriesService.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    timeSeriesService.getDatapoints.mockRejectedValue(
      new CdfServiceError('Unavailable', { kind: 'transient', status: 503 })
    );
    activityService.getAssetActivities.mockResolvedValue([
      makeActivity('WO-1', { name: 'Replace mechanical seal' }),
    ]);
    fileService.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID sheet 3' }),
    ]);
    const initialState = JSON.stringify({
      view: 'detail',
      asset: ASSET_ID,
      selectedTs: [{ space: 'my-space', externalId: 'PUMP-001:pressure' }],
      range: {
        presetKey: 'last24h',
        start: end - 24 * 60 * 60 * 1000,
        end,
      },
    });

    renderDetailView(initialState);

    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    expect(await screen.findByText('Replace mechanical seal')).toBeInTheDocument();
    expect(await screen.findByText('P&ID sheet 3')).toBeInTheDocument();
    expect(
      await screen.findByText('Could not load historical datapoints')
    ).toBeInTheDocument();
  });

  it('keeps the asset header, time series, and activities isolated while a preview loads', async () => {
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', { name: 'Feed water pump' })
    );
    timeSeriesService.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    activityService.getAssetActivities.mockResolvedValue([
      makeActivity('WO-1', { name: 'Replace mechanical seal' }),
    ]);
    fileService.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID', mimeType: 'application/pdf' }),
    ]);
    fileService.getDownloadUrl.mockReturnValue(new Promise(() => undefined));
    renderDetailView();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Preview document' })
    );

    expect(screen.getByRole('dialog', { name: 'P&ID' })).toBeInTheDocument();
    expect(screen.getByText('Feed water pump')).toBeInTheDocument();
    expect(screen.getByText('Discharge pressure')).toBeInTheDocument();
    expect(screen.getByText('Replace mechanical seal')).toBeInTheDocument();
  });

  it('offers a way back to search in every state', async () => {
    assetService.getAsset.mockResolvedValue(makeAsset('PUMP-001', { name: 'Feed water pump' }));
    renderDetailView();

    await userEvent.click(screen.getByRole('button', { name: 'Back to search' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('re-reads the asset on demand once the header is ready, without changing route or host state', async () => {
    // Arrange
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', { name: 'Feed water pump' })
    );
    renderDetailView();
    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    expect(assetService.getAsset).toHaveBeenCalledTimes(1);

    // Act
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', { name: 'Feed water pump (rev 2)' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh asset' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Feed water pump (rev 2)' })
    ).toBeInTheDocument();
    expect(assetService.getAsset).toHaveBeenCalledTimes(2);
    expect(assetService.getAsset).toHaveBeenNthCalledWith(2, ASSET_ID);
    expect(onBack).not.toHaveBeenCalled();
    expect(api.syncInternalState).not.toHaveBeenCalled();
  });

  it('shows an error when refreshing the header fails, without leaving the current route', async () => {
    // Arrange
    assetService.getAsset.mockResolvedValueOnce(
      makeAsset('PUMP-001', { name: 'Feed water pump' })
    );
    renderDetailView();
    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();

    // Act
    assetService.getAsset.mockRejectedValueOnce(
      new CdfServiceError('Service unavailable', { kind: 'transient', status: 503 })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh asset' }));

    // Assert
    expect(await screen.findByText('Could not load this asset')).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    expect(api.syncInternalState).not.toHaveBeenCalled();
  });

  it('does not refetch unrelated panels when only the header is refreshed', async () => {
    // Arrange
    assetService.getAsset.mockResolvedValue(
      makeAsset('PUMP-001', { name: 'Feed water pump' })
    );
    timeSeriesService.getAssetTimeSeries.mockResolvedValue([
      makeTimeSeries('PUMP-001:pressure', { name: 'Discharge pressure' }),
    ]);
    activityService.getAssetActivities.mockResolvedValue([
      makeActivity('WO-1', { name: 'Replace mechanical seal' }),
    ]);
    fileService.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID sheet 3' }),
    ]);
    renderDetailView();
    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    await screen.findByRole('checkbox', { name: /discharge pressure/i });
    await screen.findByText('Replace mechanical seal');
    await screen.findByText('P&ID sheet 3');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Refresh asset' }));
    await waitFor(() => expect(assetService.getAsset).toHaveBeenCalledTimes(2));

    // Assert
    expect(timeSeriesService.getAssetTimeSeries).toHaveBeenCalledTimes(1);
    expect(activityService.getAssetActivities).toHaveBeenCalledTimes(1);
    expect(fileService.getAssetFiles).toHaveBeenCalledTimes(1);
  });

  function renderDetailView(initialState?: string) {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <AssetServiceContext.Provider
          value={{ ...DEFAULT_ASSET_SERVICE_DEPS, useAssetService: () => assetService }}
        >
          <TimeSeriesServiceContext.Provider
            value={{
              ...DEFAULT_TIME_SERIES_SERVICE_DEPS,
              useTimeSeriesService: () => timeSeriesService,
            }}
          >
            <ActivityServiceContext.Provider
              value={{
                ...DEFAULT_ACTIVITY_SERVICE_DEPS,
                useActivityService: () => activityService,
              }}
            >
              <FileServiceContext.Provider
                value={{
                  ...DEFAULT_FILE_SERVICE_DEPS,
                  useFileService: () => fileService,
                }}
              >
                <HostAppContext.Provider value={{ api, initialState }}>
                  <AppStateProvider>
                    <AssetDetailView asset={ASSET_ID} onBack={onBack} />
                  </AppStateProvider>
                </HostAppContext.Provider>
              </FileServiceContext.Provider>
            </ActivityServiceContext.Provider>
          </TimeSeriesServiceContext.Provider>
        </AssetServiceContext.Provider>
      </QueryClientProvider>
    );
  }
});
