import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRouter } from './AppRouter';
import { AppStateProvider } from './AppStateProvider';

import type { ActivityServiceStub } from '@/__mocks__/activityService';
import { createActivityServiceStub } from '@/__mocks__/activityService';
import type { AssetServiceStub } from '@/__mocks__/assetService';
import { createAssetServiceStub, makeAsset } from '@/__mocks__/assetService';
import type { FileServiceStub } from '@/__mocks__/fileService';
import { createFileServiceStub } from '@/__mocks__/fileService';
import { createTestQueryClient } from '@/__mocks__/queryClient';
import type { TimeSeriesServiceStub } from '@/__mocks__/timeSeriesService';
import { createTimeSeriesServiceStub } from '@/__mocks__/timeSeriesService';
import type { HostAppApi } from '@/host/HostAppContext';
import { HostAppContext } from '@/host/HostAppContext';
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

const ASSET = { space: 'my-space', externalId: 'PUMP-001' };

describe(AppRouter.name, () => {
  let assetService: AssetServiceStub;
  let activityService: ActivityServiceStub;
  let fileService: FileServiceStub;
  let timeSeriesService: TimeSeriesServiceStub;
  let api: HostAppApi;

  beforeEach(() => {
    assetService = createAssetServiceStub();
    assetService.getAsset.mockResolvedValue(makeAsset('PUMP-001', { name: 'Feed water pump' }));
    activityService = createActivityServiceStub();
    fileService = createFileServiceStub();
    timeSeriesService = createTimeSeriesServiceStub();
    api = {
      navigateExternal: vi.fn(() => Promise.resolve(true)),
      syncInternalState: vi.fn(() => Promise.resolve(true)),
    };
  });

  it('renders the search view by default', () => {
    renderRouter();

    expect(screen.getByRole('heading', { name: 'Find an asset' })).toBeInTheDocument();
  });

  it('renders the detail view for a restored asset', async () => {
    renderRouter(JSON.stringify({ view: 'detail', asset: ASSET }));

    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    expect(screen.getByText('PUMP-001')).toBeInTheDocument();
  });

  it('opens the detail view for the asset selected in search', async () => {
    // Arrange
    assetService.searchAssets.mockResolvedValue([makeAsset('PUMP-001', { name: 'Feed water pump' })]);
    renderRouter();

    // Act
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'pump');
    await userEvent.click(await screen.findByRole('button', { name: /PUMP-001/ }));

    // Assert
    expect(await screen.findByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument();
    expect(assetService.getAsset).toHaveBeenCalledWith(ASSET);
  });

  it('returns to the search view when the user navigates back', async () => {
    renderRouter(JSON.stringify({ view: 'detail', asset: ASSET }));

    await userEvent.click(screen.getByRole('button', { name: /back to search/i }));

    expect(screen.getByRole('heading', { name: 'Find an asset' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Feed water pump' })).not.toBeInTheDocument();
  });

  function renderRouter(initialState?: string) {
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
                    <AppRouter />
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
