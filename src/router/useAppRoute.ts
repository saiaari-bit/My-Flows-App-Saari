import { useCallback, useContext, useMemo } from 'react';

import { AppStateContext } from './AppStateContext';
import type { RouteAction } from './routeState';
import { routeReducer } from './routeState';

import type { AppState, InstanceRef, TimeRange } from '@/host/hostState';
import { serializeAppState } from '@/host/hostState';
import { useHostApp } from '@/host/useHostApp';


export type AppRoute = {
  state: AppState;
  openSearch: () => void;
  setQuery: (query: string) => void;
  openAsset: (asset: InstanceRef) => void;
  setSelectedTimeSeries: (selectedTs: InstanceRef[]) => void;
  toggleTimeSeries: (timeSeries: InstanceRef) => void;
  setTimeRange: (range: TimeRange) => void;
};

/**
 * View model for host-synced navigation (SPEC FR-003, FR-004).
 *
 * Every action updates the shared store and pushes the resulting state to the
 * host, which is what makes the current asset, time-series selection, and chart
 * range survive a reload and travel through a shared link.
 *
 * The next state is computed with the same pure reducer rather than read from a
 * later render, so the payload handed to the host matches the transition that
 * triggered it. Syncing only happens inside these callbacks, so restoring a
 * deep link on boot never writes back to the host.
 */
export function useAppRoute(): AppRoute {
  const { state, dispatch } = useContext(AppStateContext);
  const { api } = useHostApp();

  const run = useCallback(
    (action: RouteAction) => {
      dispatch(action);
      const next = routeReducer(state, action);
      void api?.syncInternalState(serializeAppState(next));
    },
    [api, dispatch, state]
  );

  const openSearch = useCallback(() => run({ type: 'openSearch' }), [run]);

  const setQuery = useCallback((query: string) => run({ type: 'setQuery', query }), [run]);

  const openAsset = useCallback((asset: InstanceRef) => run({ type: 'openAsset', asset }), [run]);

  const setSelectedTimeSeries = useCallback(
    (selectedTs: InstanceRef[]) => run({ type: 'setSelectedTimeSeries', selectedTs }),
    [run]
  );

  const toggleTimeSeries = useCallback(
    (timeSeries: InstanceRef) => run({ type: 'toggleTimeSeries', timeSeries }),
    [run]
  );

  const setTimeRange = useCallback((range: TimeRange) => run({ type: 'setTimeRange', range }), [run]);

  return useMemo(
    () => ({
      state,
      openSearch,
      setQuery,
      openAsset,
      setSelectedTimeSeries,
      toggleTimeSeries,
      setTimeRange,
    }),
    [state, openSearch, setQuery, openAsset, setSelectedTimeSeries, toggleTimeSeries, setTimeRange]
  );
}
