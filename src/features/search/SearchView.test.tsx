import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchView } from './SearchView';

import type { AssetServiceStub } from '@/__mocks__/assetService';
import { createAssetServiceStub, makeAsset } from '@/__mocks__/assetService';
import type { RecentlyViewedContextValue } from '@/features/recently-viewed/RecentlyViewedContext';
import { RecentlyViewedContext } from '@/features/recently-viewed/RecentlyViewedContext';
import type { HostAppApi } from '@/host/HostAppContext';
import { HostAppContext } from '@/host/HostAppContext';
import { AppStateProvider } from '@/router/AppStateProvider';
import { CdfServiceError } from '@/services/cdfError';
import { AssetServiceContext, DEFAULT_ASSET_SERVICE_DEPS } from '@/services/useAssetService';

/** Short enough to keep tests quick, long enough to swallow a burst of typing. */
const DEBOUNCE_MS = 50;

describe(SearchView.name, () => {
  let assetService: AssetServiceStub;
  let api: HostAppApi;
  let recentlyViewed: RecentlyViewedContextValue;
  let user: UserEvent;

  beforeEach(() => {
    assetService = createAssetServiceStub();
    api = {
      navigateExternal: vi.fn(() => Promise.resolve(true)),
      syncInternalState: vi.fn(() => Promise.resolve(true)),
    };
    recentlyViewed = {
      assets: [],
      record: vi.fn(),
      remove: vi.fn(),
    };
    user = userEvent.setup({ delay: null });
  });

  it('invites the user to search and asks CDF for nothing', () => {
    renderSearchView();

    expect(screen.getByRole('searchbox', { name: 'Search assets' })).toHaveValue('');
    expect(screen.getByText(/start with a tag/i)).toBeInTheDocument();
    expect(assetService.searchAssets).not.toHaveBeenCalled();
  });

  it('shows persisted recent assets without performing a CDF search', () => {
    recentlyViewed.assets = [
      {
        space: 'my-space',
        externalId: 'PUMP-001',
        name: 'Feed water pump',
        description: 'Boiler feed',
      },
    ];

    renderSearchView();

    const list = screen.getByRole('list', { name: 'Recently viewed assets' });
    expect(within(list).getByText('Feed water pump')).toBeInTheDocument();
    expect(within(list).getByText('Boiler feed')).toBeInTheDocument();
    expect(assetService.searchAssets).not.toHaveBeenCalled();
  });

  it('opens a recent asset when its button is activated from the keyboard', async () => {
    recentlyViewed.assets = [
      {
        space: 'my-space',
        externalId: 'PUMP-001',
        name: 'Feed water pump',
      },
    ];
    renderSearchView();
    const recent = screen.getByRole('button', { name: /PUMP-001/ });

    act(() => recent.focus());
    await user.keyboard('{Enter}');

    expect(recent).toHaveFocus();
    expect(lastSyncedState()).toEqual({
      view: 'detail',
      asset: { space: 'my-space', externalId: 'PUMP-001' },
    });
  });

  it('issues a single request for a burst of typing', async () => {
    // Arrange
    renderSearchView();

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'pump');

    // Assert
    await waitFor(() => expect(assetService.searchAssets).toHaveBeenCalledTimes(1));
    expect(assetService.searchAssets).toHaveBeenCalledWith('pump');
  });

  it('shows a loading state while the search is in flight', async () => {
    assetService.searchAssets.mockReturnValue(new Promise(() => undefined));
    renderSearchView();

    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'pump');

    expect(await screen.findByText('Searching assets...')).toBeInTheDocument();
  });

  it('lists matching assets with the exact tag first', async () => {
    // Arrange
    assetService.searchAssets.mockResolvedValue([
      makeAsset('PUMP-0012', { name: 'Pump 12' }),
      makeAsset('PUMP-001', { name: 'Feed water pump', description: 'Boiler feed water' }),
    ]);
    renderSearchView();

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'PUMP-001');

    // Assert
    const results = await screen.findByRole('list', { name: 'Asset search results' });
    const items = within(results).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Feed water pump');
    expect(items[0]).toHaveTextContent('Boiler feed water');
    expect(items[1]).toHaveTextContent('Pump 12');
    expect(screen.getByText('2 matching assets')).toBeInTheDocument();
  });

  it('reports when nothing matches the query', async () => {
    renderSearchView();

    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'nothing');

    expect(await screen.findByText(/no assets match/i)).toBeInTheDocument();
  });

  it('explains a failed search and recovers when the user retries', async () => {
    // Arrange
    assetService.searchAssets.mockRejectedValueOnce(
      new CdfServiceError('Too many requests', { kind: 'transient', status: 429 })
    );
    renderSearchView();
    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'pump');
    expect(await screen.findByText('Asset search failed')).toBeInTheDocument();
    expect(screen.getByText(/timed out or was throttled/i)).toBeInTheDocument();

    // Act
    assetService.searchAssets.mockResolvedValue([makeAsset('PUMP-001', { name: 'Feed water pump' })]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByRole('button', { name: /PUMP-001/ })).toBeInTheDocument();
    expect(screen.queryByText('Asset search failed')).not.toBeInTheDocument();
  });

  it('names the missing capability when the user cannot read assets', async () => {
    assetService.searchAssets.mockRejectedValue(
      new CdfServiceError('Insufficient access rights', { kind: 'no-access', status: 403 })
    );
    renderSearchView();

    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'pump');

    expect(await screen.findByText(/do not have access to read assets/i)).toBeInTheDocument();
  });

  it('opens the asset the user clicks and hands it to the host for deep linking', async () => {
    // Arrange
    assetService.searchAssets.mockResolvedValue([makeAsset('PUMP-001', { name: 'Feed water pump' })]);
    renderSearchView();
    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'pump');

    // Act
    await user.click(await screen.findByRole('button', { name: /PUMP-001/ }));

    // Assert
    expect(lastSyncedState()).toEqual({
      view: 'detail',
      query: 'pump',
      asset: { space: 'my-space', externalId: 'PUMP-001' },
    });
  });

  it('opens a result activated from the keyboard', async () => {
    // Arrange
    assetService.searchAssets.mockResolvedValue([makeAsset('PUMP-001', { name: 'Feed water pump' })]);
    renderSearchView();
    await user.type(screen.getByRole('searchbox', { name: 'Search assets' }), 'pump');
    const result = await screen.findByRole('button', { name: /PUMP-001/ });

    // Act
    act(() => result.focus());
    await user.keyboard('{Enter}');

    // Assert
    expect(result).toHaveFocus();
    expect(lastSyncedState()).toEqual({
      view: 'detail',
      query: 'pump',
      asset: { space: 'my-space', externalId: 'PUMP-001' },
    });
  });

  it('restores and re-runs a query carried by a deep link', async () => {
    assetService.searchAssets.mockResolvedValue([makeAsset('PUMP-001', { name: 'Feed water pump' })]);

    renderSearchView(JSON.stringify({ view: 'search', query: 'pump' }));

    expect(screen.getByRole('searchbox', { name: 'Search assets' })).toHaveValue('pump');
    expect(await screen.findByRole('button', { name: /PUMP-001/ })).toBeInTheDocument();
  });

  it('returns to the initial state when the query is cleared', async () => {
    assetService.searchAssets.mockResolvedValue([makeAsset('PUMP-001', { name: 'Feed water pump' })]);
    renderSearchView(JSON.stringify({ view: 'search', query: 'pump' }));
    await screen.findByRole('button', { name: /PUMP-001/ });

    await user.clear(screen.getByRole('searchbox', { name: 'Search assets' }));

    expect(await screen.findByText(/start with a tag/i)).toBeInTheDocument();
  });

  /** The host receives a JSON string; comparing parsed state keeps key order out of the assertion. */
  function lastSyncedState(): unknown {
    const calls = vi.mocked(api.syncInternalState).mock.calls;
    const last = calls[calls.length - 1]?.[0];
    return last === undefined ? undefined : JSON.parse(last);
  }

  function renderSearchView(initialState?: string) {
    return render(
      <AssetServiceContext.Provider
        value={{ ...DEFAULT_ASSET_SERVICE_DEPS, useAssetService: () => assetService }}
      >
        <RecentlyViewedContext.Provider value={recentlyViewed}>
          <HostAppContext.Provider value={{ api, initialState }}>
            <AppStateProvider>
              <SearchView debounceMs={DEBOUNCE_MS} />
            </AppStateProvider>
          </HostAppContext.Provider>
        </RecentlyViewedContext.Provider>
      </AssetServiceContext.Provider>
    );
  }
});
