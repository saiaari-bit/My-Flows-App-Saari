import { Alert, AlertActions, AlertButton, AlertDescription, AlertTitle } from '@cognite/aura/components/alert';
import { Badge } from '@cognite/aura/components/badge';
import { Button } from '@cognite/aura/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cognite/aura/components/card';
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from '@cognite/aura/components/empty-state';
import { Label } from '@cognite/aura/components/label';
import { Loader } from '@cognite/aura/components/loader';
import { Search } from '@cognite/aura/components/search';

import { SearchStateProvider } from './SearchStateProvider';
import type { SearchViewModel } from './useSearchViewModel';
import { useSearchViewModel } from './useSearchViewModel';

import type { Asset } from '@/services/assetService';
import type { ServiceErrorKind } from '@/services/cdfError';
import { instanceIdKey } from '@/services/cdm';

const SEARCH_INPUT_ID = 'asset-search-input';

const ERROR_DESCRIPTIONS: Record<ServiceErrorKind, string> = {
  'no-access': 'You do not have access to read assets in this project. Ask an administrator for CogniteAsset read access.',
  transient: 'The asset search timed out or was throttled. Try again in a moment.',
  unknown: 'The asset search could not be completed.',
};

type SearchViewProps = {
  /** Forwarded to the search session; only tests override the debounce. */
  debounceMs?: number;
};

/**
 * Asset search (SPEC FR-001, FR-002).
 *
 * The session store is rendered here, above the single component that reads the
 * view model, so search results survive re-renders of the list itself.
 */
export function SearchView({ debounceMs }: SearchViewProps) {
  return (
    <SearchStateProvider debounceMs={debounceMs}>
      <SearchPanel />
    </SearchStateProvider>
  );
}

function SearchPanel() {
  const viewModel = useSearchViewModel();
  const { query, setQuery } = viewModel;

  return (
    <section aria-labelledby="search-view-heading" className="mx-auto w-full max-w-5xl p-6">
      <Card>
        <CardHeader>
          <CardTitle as="h1" id="search-view-heading">
            Find an asset
          </CardTitle>
          <CardDescription>
            Search by tag, name, or description to open an Asset 360 investigation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={SEARCH_INPUT_ID}>Search assets</Label>
            <Search
              autoComplete="off"
              id={SEARCH_INPUT_ID}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery('')}
              placeholder="Tag, name, or description"
              value={query}
            />
          </div>
          <SearchResults viewModel={viewModel} />
        </CardContent>
      </Card>
    </section>
  );
}

function SearchResults({ viewModel }: { viewModel: SearchViewModel }) {
  const {
    errorKind,
    query,
    recentlyViewed,
    results,
    retry,
    selectAsset,
    status,
  } = viewModel;

  if (status === 'idle') {
    if (recentlyViewed.length > 0) {
      return (
        <section aria-labelledby="recently-viewed-heading" className="flex flex-col gap-2">
          <div>
            <h2 className="font-medium" id="recently-viewed-heading">
              Recently viewed
            </h2>
            <p className="text-sm text-muted-foreground">
              Assets opened recently on this device.
            </p>
          </div>
          <ul aria-label="Recently viewed assets" className="flex flex-col gap-1">
            {recentlyViewed.map((asset) => (
              <li key={instanceIdKey(asset)}>
                <AssetResult asset={asset} onSelect={selectAsset} />
              </li>
            ))}
          </ul>
        </section>
      );
    }
    return (
      <EmptyState type="new-object">
        <EmptyStateTitle as="h2">Start with a tag</EmptyStateTitle>
        <EmptyStateDescription>
          Type at least part of a tag, name, or description to see matching assets.
        </EmptyStateDescription>
      </EmptyState>
    );
  }

  if (status === 'loading') {
    return (
      <div aria-live="polite" className="flex items-center gap-3 text-muted-foreground" role="status">
        <Loader size={20} />
        <span>Searching assets...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Alert alertStyle="card" variant="error">
        <AlertTitle>Asset search failed</AlertTitle>
        <AlertDescription>{ERROR_DESCRIPTIONS[errorKind ?? 'unknown']}</AlertDescription>
        <AlertActions>
          <AlertButton onClick={retry} type="button">
            Try again
          </AlertButton>
        </AlertActions>
      </Alert>
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState type="no-results">
        <EmptyStateTitle as="h2">No assets match {query}</EmptyStateTitle>
        <EmptyStateDescription>
          Check the spelling, or search by name or description instead of the tag.
        </EmptyStateDescription>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
        {results.length === 1 ? '1 matching asset' : `${results.length} matching assets`}
      </p>
      <ul aria-label="Asset search results" className="flex flex-col gap-1">
        {results.map((asset) => (
          <li key={instanceIdKey(asset)}>
            <AssetResult asset={asset} onSelect={selectAsset} />
          </li>
        ))}
      </ul>
    </div>
  );
}

type AssetResultProps = {
  asset: Asset;
  onSelect: (asset: Asset) => void;
};

/**
 * A native button, so every result is reachable and activatable by keyboard.
 * Long names and descriptions truncate rather than widening the page (AS-21).
 */
function AssetResult({ asset, onSelect }: AssetResultProps) {
  return (
    <Button
      className="h-auto w-full flex-col items-start gap-1 py-3 text-left"
      onClick={() => onSelect(asset)}
      variant="ghost"
    >
      <span className="flex w-full min-w-0 items-center gap-2">
        <span className="truncate font-medium">{asset.name ?? asset.externalId}</span>
        <Badge background variant="nordic">
          {asset.externalId}
        </Badge>
      </span>
      {asset.description !== undefined && (
        <span className="w-full truncate text-muted-foreground">{asset.description}</span>
      )}
    </Button>
  );
}
