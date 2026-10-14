import type { HostAppAPI, ConnectToHostAppResult } from '@cognite/app-sdk';
import { CogniteClient } from '@cognite/sdk';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

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

type AppDeps = NonNullable<ComponentProps<typeof App>['deps']>;

type AppApi = Pick<HostAppAPI, 'navigateExternal' | 'syncInternalState'>;

const ASSET = { space: 'my-space', externalId: 'PUMP-001' };

let assetService: AssetServiceStub;
let activityService: ActivityServiceStub;
let fileService: FileServiceStub;
let timeSeriesService: TimeSeriesServiceStub;

/**
 * The app is rendered whole here, so the asset read seam is stubbed at the
 * outermost context: no test in this file may reach a real CDF endpoint.
 */
function renderApp(element: ReactElement) {
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
              {element}
            </FileServiceContext.Provider>
          </ActivityServiceContext.Provider>
        </TimeSeriesServiceContext.Provider>
      </AssetServiceContext.Provider>
    </QueryClientProvider>
  );
}

function makeApi(): AppApi {
  return {
    navigateExternal: vi.fn<HostAppAPI['navigateExternal']>(() => Promise.resolve(true)),
    syncInternalState: vi.fn<HostAppAPI['syncInternalState']>(() => Promise.resolve(true)),
  };
}

function makeConnectedFn(api: HostAppApi = makeApi(), initialState?: string) {
  return vi.fn(() => Promise.resolve({ api, initialState }));
}

function makeDeps(): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() =>
      Promise.resolve({
        api: {
          getProject: vi.fn<HostAppAPI['getProject']>(() => Promise.resolve('publicdatacdm')),
          getBaseUrl: vi.fn<HostAppAPI['getBaseUrl']>(() => Promise.resolve('https://cognite.test')),
          getAccessToken: vi.fn<HostAppAPI['getAccessToken']>(() => Promise.resolve('test-token')),
          getAppId: vi.fn<HostAppAPI['getAppId']>(() => Promise.resolve('test-app-id')),
        } as Partial<HostAppAPI> as HostAppAPI,
      })
    ),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

function makeLoadingDeps(): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() => new Promise<ConnectToHostAppResult>(() => undefined)),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
    assetService = createAssetServiceStub();
    assetService.getAsset.mockResolvedValue(makeAsset('PUMP-001', { name: 'Feed water pump' }));
    activityService = createActivityServiceStub();
    fileService = createFileServiceStub();
    timeSeriesService = createTimeSeriesServiceStub();
  });

  it('renders loading state', () => {
    renderApp(<App deps={makeLoadingDeps()} connectToHostApp={() => new Promise<never>(() => undefined)} />);
    expect(screen.getByText('Loading project...')).toBeInTheDocument();
  });

  it('keeps showing the loading state until the host connection resolves', () => {
    renderApp(<App deps={makeDeps()} connectToHostApp={() => new Promise<never>(() => undefined)} />);
    expect(screen.getByText('Loading project...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Find an asset' })).not.toBeInTheDocument();
  });

  it('reads the CDF project name from the host', async () => {
    const api: HostAppApi = {
      ...makeApi(),
      getProject: vi.fn<HostAppAPI['getProject']>(() => Promise.resolve('publicdatacdm')),
    };
    renderApp(<App deps={makeDeps()} connectToHostApp={makeConnectedFn(api)} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Find an asset' })).toBeInTheDocument()
    );
    expect(api.getProject).toHaveBeenCalled();
  });

  it('stays usable when the host cannot report the project', async () => {
    const api: HostAppApi = {
      ...makeApi(),
      getProject: vi.fn<HostAppAPI['getProject']>(() => Promise.reject(new Error('unavailable'))),
    };
    renderApp(<App deps={makeDeps()} connectToHostApp={makeConnectedFn(api)} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Find an asset' })).toBeInTheDocument()
    );
  });

  it('renders the search view when the host supplies no initial state', async () => {
    renderApp(<App deps={makeDeps()} connectToHostApp={makeConnectedFn()} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Find an asset' })).toBeInTheDocument()
    );
  });

  it('renders the asset detail view for a deep-linked asset', async () => {
    const initialState = JSON.stringify({ view: 'detail', asset: ASSET });
    renderApp(<App deps={makeDeps()} connectToHostApp={makeConnectedFn(makeApi(), initialState)} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument()
    );
    expect(screen.getByText('PUMP-001')).toBeInTheDocument();
    expect(screen.getByText('my-space')).toBeInTheDocument();
    expect(assetService.getAsset).toHaveBeenCalledWith(ASSET);
  });

  it('removes a recent entry only after the asset is confirmed missing', async () => {
    window.localStorage.setItem(
      'asset-360:recently-viewed:standalone',
      JSON.stringify([
        {
          space: 'my-space',
          externalId: 'DELETED-1',
          name: 'Deleted pump',
        },
      ])
    );
    assetService.getAsset.mockResolvedValue(null);
    renderApp(<App deps={makeDeps()} connectToHostApp={makeConnectedFn()} />);
    await userEvent.click(
      await screen.findByRole('button', { name: /DELETED-1/ })
    );
    expect(
      await screen.findByRole('heading', { name: 'Asset not found' })
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /back to search/i })
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('list', { name: 'Recently viewed assets' })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText(/start with a tag/i)).toBeInTheDocument();
  });

  it('restores the selected time series and chart range from initial state', async () => {
    const api = makeApi();
    const initialState = JSON.stringify({
      view: 'detail',
      asset: ASSET,
      selectedTs: [{ space: 'my-space', externalId: 'PUMP-001:pressure' }],
      range: { presetKey: 'last7d', end: 1730000000000 },
    });
    renderApp(<App deps={makeDeps()} connectToHostApp={makeConnectedFn(api, initialState)} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument()
    );

    // Restoring a deep link is not a user-driven change, so it must not write back.
    expect(api.syncInternalState).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid JSON', '{{{not json'],
    ['an unknown view', JSON.stringify({ view: 'dashboard' })],
    ['a detail route with no asset', JSON.stringify({ view: 'detail' })],
    ['a malformed asset reference', JSON.stringify({ view: 'detail', asset: { space: 'my-space' } })],
  ])('falls back to the search view when initial state is %s', async (_label, initialState) => {
    renderApp(<App deps={makeDeps()} connectToHostApp={makeConnectedFn(makeApi(), initialState)} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Find an asset' })).toBeInTheDocument()
    );
    expect(assetService.getAsset).not.toHaveBeenCalled();
  });

  it('syncs internal state when the user changes route', async () => {
    const api = makeApi();
    const initialState = JSON.stringify({ view: 'detail', asset: ASSET });
    renderApp(<App deps={makeDeps()} connectToHostApp={makeConnectedFn(api, initialState)} />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Feed water pump' })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('button', { name: /back to search/i }));

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ view: 'search', asset: ASSET })
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Find an asset' })).toBeInTheDocument()
    );
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
