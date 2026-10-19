import type { Asset } from '@/services/assetService';
import type { ServiceErrorKind } from '@/services/cdfError';

/**
 * Result state for the asset search (SPEC FR-001).
 *
 * This is the transient half of search: what CDF answered for the query the
 * user last settled on. The query text itself is host-synced route state, not
 * stored here, so a shared link reproduces the same result list.
 */
export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export type SearchState = {
  /** The query the current status and results describe. Empty while idle. */
  query: string;
  status: SearchStatus;
  results: Asset[];
  errorKind?: ServiceErrorKind;
};

export const IDLE_SEARCH_STATE: SearchState = { query: '', status: 'idle', results: [] };

export type SearchAction =
  | { type: 'searchCleared' }
  | { type: 'searchStarted'; query: string }
  | { type: 'searchSucceeded'; query: string; results: Asset[] }
  | { type: 'searchFailed'; query: string; kind: ServiceErrorKind };

/**
 * Every completion carries the query it answers, and a completion for anything
 * other than the query currently in flight is dropped. Without that guard a
 * slow request for `pu` could land after a fast one for `pump` and repopulate
 * the list with results the user has already typed past.
 */
export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'searchCleared':
      return isIdle(state) ? state : IDLE_SEARCH_STATE;

    case 'searchStarted':
      return { query: action.query, status: 'loading', results: [] };

    case 'searchSucceeded':
      if (action.query !== state.query) return state;
      return { query: state.query, status: 'ready', results: rankAssets(state.query, action.results) };

    case 'searchFailed':
      if (action.query !== state.query) return state;
      return { query: state.query, status: 'error', results: [], errorKind: action.kind };
  }
}

/**
 * Orders results so the most literal reading of what the user typed comes first
 * (SPEC AS-1): an exact plant tag, then a tag prefix, then an exact name, then
 * everything the free-text search matched on name or description.
 *
 * The sort is stable, so relevance order from CDF is preserved inside a tier.
 */
export function rankAssets(query: string, assets: readonly Asset[]): Asset[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...assets];
  return [...assets].sort((a, b) => tierOf(a, needle) - tierOf(b, needle));
}

function tierOf(asset: Asset, needle: string): number {
  const externalId = asset.externalId.toLowerCase();
  if (externalId === needle) return 0;
  if (externalId.startsWith(needle)) return 1;
  if (asset.name !== undefined && asset.name.toLowerCase() === needle) return 2;
  return 3;
}

function isIdle(state: SearchState): boolean {
  return state.status === 'idle' && state.query === '' && state.results.length === 0;
}
