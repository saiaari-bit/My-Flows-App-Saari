import { createContext } from 'react';

import type { SearchAction, SearchState } from './searchState';
import { IDLE_SEARCH_STATE } from './searchState';

/**
 * Shared storage for the asset search session.
 *
 * Search result state lives here rather than inside `useSearchViewModel` so
 * every component calling the view model observes the same value
 * (AGENTS.md §5).
 */
export type SearchStateContextValue = {
  state: SearchState;
  dispatch: (action: SearchAction) => void;
  /** How long typing must settle before a CDF request is issued (SPEC FR-010). */
  debounceMs: number;
};

/** Long enough to swallow a burst of typing, short enough to feel immediate. */
export const SEARCH_DEBOUNCE_MS = 300;

export const DEFAULT_SEARCH_STATE_CONTEXT: SearchStateContextValue = {
  state: IDLE_SEARCH_STATE,
  dispatch: () => undefined,
  debounceMs: SEARCH_DEBOUNCE_MS,
};

export const SearchStateContext = createContext<SearchStateContextValue>(DEFAULT_SEARCH_STATE_CONTEXT);
