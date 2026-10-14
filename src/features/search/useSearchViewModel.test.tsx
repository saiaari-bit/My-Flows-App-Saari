import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchStateProvider } from './SearchStateProvider';
import { useSearchViewModel } from './useSearchViewModel';

import type { AssetServiceStub } from '@/__mocks__/assetService';
import { createAssetServiceStub, makeAsset } from '@/__mocks__/assetService';
import type { HostAppApi } from '@/host/HostAppContext';
import { HostAppContext } from '@/host/HostAppContext';
import { AppStateProvider } from '@/router/AppStateProvider';
import { CdfServiceError } from '@/services/cdfError';
import { AssetServiceContext, DEFAULT_ASSET_SERVICE_DEPS } from '@/services/useAssetService';

const DEBOUNCE_MS = 300;

describe(useSearchViewModel.name, () => {
  let assetService: AssetServiceStub;
  let api: HostAppApi;

  beforeEach(() => {
    vi.useFakeTimers();
    assetService = createAssetServiceStub();
    api = {
      navigateExternal: vi.fn(() => Promise.resolve(true)),
      syncInternalState: vi.fn(() => Promise.resolve(true)),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle and searches nothing until the user types', () => {
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });

    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS * 2));

    expect(result.current).toMatchObject({ query: '', status: 'idle', results: [] });
    expect(assetService.searchAssets).not.toHaveBeenCalled();
  });

  it('syncs the query to the host so a shared link reproduces the search', () => {
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });

    act(() => result.current.setQuery('pu'));

    expect(result.current.query).toBe('pu');
    expect(api.syncInternalState).toHaveBeenCalledWith(JSON.stringify({ view: 'search', query: 'pu' }));
  });

  it('issues one request for a burst of typing rather than one per keystroke', async () => {
    // Arrange
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });

    // Act
    act(() => result.current.setQuery('p'));
    act(() => result.current.setQuery('pu'));
    act(() => result.current.setQuery('pump'));
    await act(async () => void vi.advanceTimersByTime(DEBOUNCE_MS));

    // Assert
    expect(assetService.searchAssets).toHaveBeenCalledTimes(1);
    expect(assetService.searchAssets).toHaveBeenCalledWith('pump');
  });

  it('searches the trimmed query', async () => {
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });

    act(() => result.current.setQuery('  pump  '));
    await act(async () => void vi.advanceTimersByTime(DEBOUNCE_MS));

    expect(assetService.searchAssets).toHaveBeenCalledWith('pump');
  });

  it('reports a loading state while the request is in flight', () => {
    assetService.searchAssets.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });

    act(() => result.current.setQuery('pump'));
    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS));

    expect(result.current.status).toBe('loading');
  });

  it('exposes results with the exact tag match first', async () => {
    // Arrange
    assetService.searchAssets.mockResolvedValue([
      makeAsset('PUMP-0012', { name: 'Pump 12' }),
      makeAsset('PUMP-001', { name: 'Feed water pump' }),
    ]);
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });

    // Act
    act(() => result.current.setQuery('PUMP-001'));
    await act(async () => void vi.advanceTimersByTime(DEBOUNCE_MS));

    // Assert
    expect(result.current.status).toBe('ready');
    expect(result.current.results.map((asset) => asset.externalId)).toEqual(['PUMP-001', 'PUMP-0012']);
  });

  it('reports an empty result set as a completed search', async () => {
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });

    act(() => result.current.setQuery('nothing'));
    await act(async () => void vi.advanceTimersByTime(DEBOUNCE_MS));

    expect(result.current).toMatchObject({ status: 'ready', results: [] });
  });

  it('classifies a failed search so the view can explain it', async () => {
    assetService.searchAssets.mockRejectedValue(
      new CdfServiceError('Insufficient access rights', { kind: 'no-access', status: 403 })
    );
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });

    act(() => result.current.setQuery('pump'));
    await act(async () => void vi.advanceTimersByTime(DEBOUNCE_MS));

    expect(result.current).toMatchObject({ status: 'error', errorKind: 'no-access' });
  });

  it('re-runs the current query when the user retries', async () => {
    // Arrange
    assetService.searchAssets.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });
    act(() => result.current.setQuery('pump'));
    await act(async () => void vi.advanceTimersByTime(DEBOUNCE_MS));
    expect(result.current.status).toBe('error');

    // Act
    assetService.searchAssets.mockResolvedValue([makeAsset('PUMP-001')]);
    await act(async () => result.current.retry());

    // Assert
    expect(assetService.searchAssets).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ status: 'ready' });
  });

  it('returns to the initial state when the query is cleared', async () => {
    assetService.searchAssets.mockResolvedValue([makeAsset('PUMP-001')]);
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });
    act(() => result.current.setQuery('pump'));
    await act(async () => void vi.advanceTimersByTime(DEBOUNCE_MS));

    act(() => result.current.setQuery(''));

    expect(result.current).toMatchObject({ status: 'idle', results: [] });
  });

  it('opens the selected asset and hands it to the host for deep linking', () => {
    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper() });

    act(() => result.current.selectAsset(makeAsset('PUMP-001', { name: 'Feed water pump' })));

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ view: 'detail', asset: { space: 'my-space', externalId: 'PUMP-001' } })
    );
  });

  it('searches a query restored from a deep link without writing back to the host', async () => {
    assetService.searchAssets.mockResolvedValue([makeAsset('PUMP-001')]);
    const initialState = JSON.stringify({ view: 'search', query: 'pump' });

    const { result } = renderHook(() => useSearchViewModel(), { wrapper: makeWrapper(initialState) });
    await act(async () => void vi.advanceTimersByTime(DEBOUNCE_MS));

    expect(assetService.searchAssets).toHaveBeenCalledWith('pump');
    expect(result.current.status).toBe('ready');
    expect(api.syncInternalState).not.toHaveBeenCalled();
  });

  function makeWrapper(initialState?: string) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <AssetServiceContext.Provider
          value={{ ...DEFAULT_ASSET_SERVICE_DEPS, useAssetService: () => assetService }}
        >
          <HostAppContext.Provider value={{ api, initialState }}>
            <AppStateProvider>
              <SearchStateProvider debounceMs={DEBOUNCE_MS}>{children}</SearchStateProvider>
            </AppStateProvider>
          </HostAppContext.Provider>
        </AssetServiceContext.Provider>
      );
    };
  }
});
