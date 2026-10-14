import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import type { AssetMatch, InstanceRef } from '../domain/asset360Types';
import { useAsset360Deps } from '../state/asset360ViewModelContext';

import { errorMessageOf } from './errorMessageOf';

export const SEARCH_DEBOUNCE_MS = 300;

export type AssetSearchStatus = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export type AssetSearchViewModel = {
  /** What the analyst is currently typing. Not shared, not host-synced. */
  inputValue: string;
  setInputValue: (value: string) => void;
  /** The debounced query actually sent to CDF. */
  committedQuery: string;
  status: AssetSearchStatus;
  results: AssetMatch[];
  errorMessage: string | undefined;
  retry: () => void;
  selected: InstanceRef | null;
  selectAsset: (match: AssetMatch) => void;
  clear: () => void;
};

/**
 * Debounces the asset search box and turns it into a ranked result list.
 *
 * Call this **once**, from the search control: the in-flight input value is
 * local to the hook, so two callers would not stay in sync. The committed query
 * and the selection do live in shared, host-synced storage.
 */
export function useAssetSearchViewModel(): AssetSearchViewModel {
  const { service, useWorkspaceStorage } = useAsset360Deps();
  const storage = useWorkspaceStorage();
  const committedQuery = storage.query;

  const [inputValue, setInputValue] = useState(committedQuery);
  const { setQuery, selectAsset: storeSelection } = storage;

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (trimmed === committedQuery) {
      return;
    }
    const timer = setTimeout(() => setQuery(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue, committedQuery, setQuery]);

  const search = useQuery({
    queryKey: ['asset360', 'assetSearch', committedQuery],
    queryFn: () => {
      if (service === null) {
        return Promise.resolve<AssetMatch[]>([]);
      }
      return service.searchAssets(committedQuery);
    },
    enabled: service !== null && committedQuery.length > 0,
    staleTime: 30_000,
  });

  const results = search.data ?? [];
  const status = resolveStatus({
    hasQuery: committedQuery.length > 0,
    isLoading: search.isLoading,
    hasError: search.error !== null,
    resultCount: results.length,
  });

  const selectAsset = useCallback(
    (match: AssetMatch) => {
      setInputValue(match.label);
      storeSelection(match.ref);
    },
    [storeSelection]
  );

  const clear = useCallback(() => {
    setInputValue('');
    setQuery('');
  }, [setQuery]);

  return {
    inputValue,
    setInputValue,
    committedQuery,
    status,
    results,
    errorMessage: errorMessageOf(search.error),
    retry: () => void search.refetch(),
    selected: storage.selected,
    selectAsset,
    clear,
  };
}

function resolveStatus(input: {
  hasQuery: boolean;
  isLoading: boolean;
  hasError: boolean;
  resultCount: number;
}): AssetSearchStatus {
  if (!input.hasQuery) {
    return 'idle';
  }
  if (input.hasError) {
    return 'error';
  }
  if (input.isLoading) {
    return 'loading';
  }
  return input.resultCount > 0 ? 'results' : 'empty';
}
