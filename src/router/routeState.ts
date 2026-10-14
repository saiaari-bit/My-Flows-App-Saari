import type { AppState, InstanceRef, TimeRange } from '@/host/hostState';
import { instanceRefEquals } from '@/host/hostState';

/**
 * User-driven route transitions (SPEC FR-003, FR-004).
 *
 * Kept as a pure reducer so every transition is testable without React and
 * without the host, and so the set of things that can change host-synced state
 * stays enumerable.
 */
export type RouteAction =
  | { type: 'openSearch' }
  | { type: 'setQuery'; query: string }
  | { type: 'openAsset'; asset: InstanceRef }
  | { type: 'setSelectedTimeSeries'; selectedTs: InstanceRef[] }
  | { type: 'toggleTimeSeries'; timeSeries: InstanceRef }
  | { type: 'setTimeRange'; range: TimeRange };

/**
 * Opening a different asset clears the previous asset's time-series selection
 * and range — those refs belong to the asset that was left behind, and keeping
 * them would plot unrelated series (violating SPEC FR-007).
 */
function openAsset(state: AppState, asset: InstanceRef): AppState {
  const isSameAsset = state.asset !== undefined && instanceRefEquals(state.asset, asset);
  if (isSameAsset) {
    return { ...state, view: 'detail' };
  }

  const next: AppState = { view: 'detail', asset };
  if (state.query !== undefined) next.query = state.query;
  return next;
}

function toggleTimeSeries(state: AppState, timeSeries: InstanceRef): AppState {
  const current = state.selectedTs ?? [];
  const isSelected = current.some((ref) => instanceRefEquals(ref, timeSeries));
  const selectedTs = isSelected
    ? current.filter((ref) => !instanceRefEquals(ref, timeSeries))
    : [...current, timeSeries];

  return { ...state, selectedTs };
}

export function routeReducer(state: AppState, action: RouteAction): AppState {
  switch (action.type) {
    case 'openSearch':
      return { ...state, view: 'search' };

    case 'setQuery':
      return { ...state, query: action.query };

    case 'openAsset':
      return openAsset(state, action.asset);

    case 'setSelectedTimeSeries':
      return { ...state, selectedTs: action.selectedTs };

    case 'toggleTimeSeries':
      return toggleTimeSeries(state, action.timeSeries);

    case 'setTimeRange':
      return { ...state, range: action.range };
  }
}
