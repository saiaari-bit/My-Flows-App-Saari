import { useCallback, useContext, useEffect, useMemo } from 'react';

import type { SearchStatus } from './searchState';
import { SearchStateContext } from './SearchStateContext';

import type { RecentlyViewedAsset } from '@/features/recently-viewed/recentlyViewedRepository';
import { useRecentlyViewed } from '@/features/recently-viewed/useRecentlyViewed';
import type { InstanceRef } from '@/host/hostState';
import { useAppRoute } from '@/router/useAppRoute';
import type { Asset } from '@/services/assetService';
import type { ServiceErrorKind } from '@/services/cdfError';
import { toCdfServiceError } from '@/services/cdfError';
import { useAssetService } from '@/services/useAssetService';

export type SearchViewModel = {
  /** Current search box text. Host-synced, so a shared link reproduces it. */
  query: string;
  status: SearchStatus;
  results: Asset[];
  recentlyViewed: RecentlyViewedAsset[];
  errorKind?: ServiceErrorKind;
  setQuery: (query: string) => void;
  /** Re-runs the current query immediately, bypassing the debounce (SPEC FR-009). */
  retry: () => void;
  selectAsset: (asset: InstanceRef) => void;
};

/**
 * View model for asset search (SPEC FR-001, FR-002).
 *
 * The query lives in host-synced route state and the results live in
 * `SearchStateContext`; this hook only composes them with the asset service, so
 * it holds no state of its own (AGENTS.md §5).
 *
 * Typing does not reach CDF. Each keystroke restarts a timer, and only the text
 * the user settles on for `debounceMs` is searched — one request per pause
 * rather than one per keystroke (SPEC FR-010).
 */
export function useSearchViewModel(): SearchViewModel {
  const { state, dispatch, debounceMs } = useContext(SearchStateContext);
  const assetService = useAssetService();
  const { assets: recentlyViewed } = useRecentlyViewed();
  const route = useAppRoute();
  const { openAsset, setQuery } = route;

  const query = route.state.query ?? '';
  const trimmed = query.trim();

  const runSearch = useCallback(
    async (text: string) => {
      dispatch({ type: 'searchStarted', query: text });
      try {
        const results = await assetService.searchAssets(text);
        dispatch({ type: 'searchSucceeded', query: text, results });
      } catch (error) {
        dispatch({ type: 'searchFailed', query: text, kind: toCdfServiceError(error).kind });
      }
    },
    [assetService, dispatch]
  );

  useEffect(() => {
    if (trimmed === '') {
      dispatch({ type: 'searchCleared' });
      return;
    }

    const timer = setTimeout(() => void runSearch(trimmed), debounceMs);
    return () => clearTimeout(timer);
  }, [debounceMs, dispatch, runSearch, trimmed]);

  const retry = useCallback(() => {
    if (trimmed !== '') void runSearch(trimmed);
  }, [runSearch, trimmed]);

  // Recording waits for the detail read to succeed; selection only changes route.
  const selectAsset = useCallback(
    (asset: InstanceRef) => openAsset({ space: asset.space, externalId: asset.externalId }),
    [openAsset]
  );

  return useMemo(
    () => ({
      query,
      status: state.status,
      results: state.results,
      recentlyViewed,
      errorKind: state.errorKind,
      setQuery,
      retry,
      selectAsset,
    }),
    [
      query,
      state.status,
      state.results,
      state.errorKind,
      recentlyViewed,
      setQuery,
      retry,
      selectAsset,
    ]
  );
}
