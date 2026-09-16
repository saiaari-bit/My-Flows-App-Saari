import { Badge } from '@cognite/aura/components/badge';
import { Skeleton } from '@cognite/aura/components/skeleton';
import type { ReactNode } from 'react';

import type { AssetSummary } from '../domain/asset360Types';
import type { SectionState } from '../hooks/useAsset360ViewModel';

import { PanelError } from './PanelState';

/**
 * Identity strip for the selected asset. Only properties that exist on
 * `cdf_cdm:CogniteAsset/v1` are shown, and each is omitted when absent rather
 * than rendered as an empty field.
 */
export function AssetSummaryBar({ state }: { state: SectionState<AssetSummary | undefined> }) {
  if (state.errorMessage !== undefined) {
    return <PanelError message={state.errorMessage} onRetry={state.retry} />;
  }

  if (state.isLoading || state.data === undefined) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label="Loading asset details">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
    );
  }

  const asset = state.data;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-medium tracking-tight text-foreground">{asset.label}</h2>
        <span className="font-mono text-xs text-muted-foreground">{asset.ref.externalId}</span>
      </div>

      {asset.description !== undefined && (
        <p className="max-w-3xl text-sm text-muted-foreground">{asset.description}</p>
      )}

      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {asset.sourceId !== undefined && <Fact label="Source id">{asset.sourceId}</Fact>}
        {asset.parent !== undefined && <Fact label="Parent">{asset.parent.externalId}</Fact>}
        {asset.root !== undefined && <Fact label="Hierarchy root">{asset.root.externalId}</Fact>}
        {asset.tags.length > 0 && (
          <Fact label="Tags">
            <span className="flex flex-wrap gap-1">
              {asset.tags.map((tag) => (
                <Badge key={tag} variant="gray" outline>
                  {tag}
                </Badge>
              ))}
            </span>
          </Fact>
        )}
      </dl>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}
