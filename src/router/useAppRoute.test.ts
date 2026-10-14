import { act, renderHook } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from './AppStateProvider';
import { useAppRoute } from './useAppRoute';

import type { HostAppApi } from '@/host/HostAppContext';
import { HostAppContext } from '@/host/HostAppContext';


const ASSET = { space: 'my-space', externalId: 'PUMP-001' };
const PRESSURE = { space: 'my-space', externalId: 'PUMP-001:pressure' };

function makeApi(): HostAppApi {
  return {
    navigateExternal: vi.fn(() => Promise.resolve(true)),
    syncInternalState: vi.fn(() => Promise.resolve(true)),
  };
}

function makeWrapper(
  api: HostAppApi,
  initialState?: string
): ComponentType<{ children: ReactNode }> {
  return ({ children }) =>
    createElement(
      HostAppContext.Provider,
      { value: { api, initialState } },
      createElement(AppStateProvider, null, children)
    );
}

describe(useAppRoute.name, () => {
  let api: HostAppApi;

  beforeEach(() => {
    vi.clearAllMocks();
    api = makeApi();
  });

  it('seeds the search view when the host supplies no state', () => {
    const { result } = renderHook(() => useAppRoute(), { wrapper: makeWrapper(api) });

    expect(result.current.state).toEqual({ view: 'search' });
  });

  it('seeds a deep-linked asset from host state', () => {
    const initialState = JSON.stringify({ view: 'detail', asset: ASSET });
    const { result } = renderHook(() => useAppRoute(), { wrapper: makeWrapper(api, initialState) });

    expect(result.current.state).toEqual({ view: 'detail', asset: ASSET });
  });

  it('seeds a safe default from malformed host state', () => {
    const { result } = renderHook(() => useAppRoute(), { wrapper: makeWrapper(api, '{{{broken') });

    expect(result.current.state).toEqual({ view: 'search' });
  });

  it('does not write back to the host while restoring a deep link', () => {
    const initialState = JSON.stringify({ view: 'detail', asset: ASSET });
    renderHook(() => useAppRoute(), { wrapper: makeWrapper(api, initialState) });

    expect(api.syncInternalState).not.toHaveBeenCalled();
  });

  it('syncs the asset to the host when the user opens one', () => {
    const { result } = renderHook(() => useAppRoute(), { wrapper: makeWrapper(api) });

    act(() => result.current.openAsset(ASSET));

    expect(result.current.state).toEqual({ view: 'detail', asset: ASSET });
    expect(api.syncInternalState).toHaveBeenCalledTimes(1);
    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ view: 'detail', asset: ASSET })
    );
  });

  it('syncs the time-series selection to the host', () => {
    const initialState = JSON.stringify({ view: 'detail', asset: ASSET });
    const { result } = renderHook(() => useAppRoute(), { wrapper: makeWrapper(api, initialState) });

    act(() => result.current.toggleTimeSeries(PRESSURE));

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ view: 'detail', asset: ASSET, selectedTs: [PRESSURE] })
    );
  });

  it('syncs the chart time range to the host', () => {
    const initialState = JSON.stringify({ view: 'detail', asset: ASSET });
    const { result } = renderHook(() => useAppRoute(), { wrapper: makeWrapper(api, initialState) });
    const range = { presetKey: 'last7d', start: 1000, end: 2000 } as const;

    act(() => result.current.setTimeRange(range));

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ view: 'detail', asset: ASSET, range })
    );
  });

  it('syncs the search query to the host', () => {
    const { result } = renderHook(() => useAppRoute(), { wrapper: makeWrapper(api) });

    act(() => result.current.setQuery('pump'));

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ view: 'search', query: 'pump' })
    );
  });

  it('syncs the return to search', () => {
    const initialState = JSON.stringify({ view: 'detail', asset: ASSET });
    const { result } = renderHook(() => useAppRoute(), { wrapper: makeWrapper(api, initialState) });

    act(() => result.current.openSearch());

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ view: 'search', asset: ASSET })
    );
  });

  it('restores the full investigation context across a simulated reload', () => {
    const first = renderHook(() => useAppRoute(), { wrapper: makeWrapper(api) });

    act(() => first.result.current.openAsset(ASSET));
    act(() => first.result.current.toggleTimeSeries(PRESSURE));
    act(() => first.result.current.setTimeRange({ presetKey: 'last24h', end: 5000 }));

    const calls = vi.mocked(api.syncInternalState).mock.calls;
    const lastSynced = calls[calls.length - 1]?.[0];

    const reloaded = renderHook(() => useAppRoute(), {
      wrapper: makeWrapper(makeApi(), lastSynced),
    });

    expect(reloaded.result.current.state).toEqual({
      view: 'detail',
      asset: ASSET,
      selectedTs: [PRESSURE],
      range: { presetKey: 'last24h', end: 5000 },
    });
  });

  it('keeps state updates working when no host api is available', () => {
    const wrapper: ComponentType<{ children: ReactNode }> = ({ children }) =>
      createElement(
        HostAppContext.Provider,
        { value: { api: null } },
        createElement(AppStateProvider, null, children)
      );

    const { result } = renderHook(() => useAppRoute(), { wrapper });

    act(() => result.current.openAsset(ASSET));

    expect(result.current.state).toEqual({ view: 'detail', asset: ASSET });
  });
});
