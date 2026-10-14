import { useAppRoute } from './useAppRoute';

import { AssetDetailView } from '@/features/asset-detail/AssetDetailView';
import { SearchView } from '@/features/search/SearchView';


/**
 * Renders the view selected by host-synced route state (SPEC FR-003).
 *
 * `parseAppState` guarantees a `detail` route always carries an asset, but the
 * check is repeated here so this component is total over its own props rather
 * than relying on an invariant enforced elsewhere.
 */
export function AppRouter() {
  const { state, openSearch } = useAppRoute();

  if (state.view === 'detail' && state.asset !== undefined) {
    return <AssetDetailView asset={state.asset} onBack={openSearch} />;
  }

  return <SearchView />;
}
