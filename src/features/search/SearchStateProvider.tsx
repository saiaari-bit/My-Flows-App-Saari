import type { ReactNode } from 'react';
import { useMemo, useReducer } from 'react';

import { IDLE_SEARCH_STATE, searchReducer } from './searchState';
import { SEARCH_DEBOUNCE_MS, SearchStateContext } from './SearchStateContext';

type SearchStateProviderProps = {
  children: ReactNode;
  /**
   * Overridable so tests do not have to wait out the production debounce; the
   * app itself always uses the default.
   */
  debounceMs?: number;
};

/** Rendered once above everything that reads search results. */
export function SearchStateProvider({ children, debounceMs = SEARCH_DEBOUNCE_MS }: SearchStateProviderProps) {
  const [state, dispatch] = useReducer(searchReducer, IDLE_SEARCH_STATE);

  const value = useMemo(() => ({ state, dispatch, debounceMs }), [state, dispatch, debounceMs]);

  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>;
}
