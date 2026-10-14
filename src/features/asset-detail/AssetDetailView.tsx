import { Alert, AlertActions, AlertButton, AlertDescription, AlertTitle } from '@cognite/aura/components/alert';
import { Badge } from '@cognite/aura/components/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@cognite/aura/components/breadcrumb';
import { Button } from '@cognite/aura/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderEnd,
  CardHeaderStart,
  CardTitle,
} from '@cognite/aura/components/card';
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from '@cognite/aura/components/empty-state';
import { Loader } from '@cognite/aura/components/loader';
import { Fragment } from 'react';

import { ActivitiesPanel } from './ActivitiesPanel';
import { DocumentsPanel } from './DocumentsPanel';
import { TimeSeriesPanel } from './TimeSeriesPanel';
import { useAssetDetailViewModel } from './useAssetDetailViewModel';

import type { InstanceRef } from '@/host/hostState';
import { instanceRefEquals } from '@/host/hostState';
import type { Asset } from '@/services/assetService';
import type { ServiceErrorKind } from '@/services/cdfError';

const ERROR_DESCRIPTIONS: Record<ServiceErrorKind, string> = {
  'no-access': 'You do not have access to read this asset. Ask an administrator for CogniteAsset read access.',
  transient: 'Reading the asset timed out or was throttled. Try again in a moment.',
  unknown: 'The asset could not be read.',
};

type AssetDetailViewProps = {
  asset: InstanceRef;
  onBack: () => void;
};

/**
 * The Asset 360 investigation workspace (SPEC FR-005).
 *
 * This slice renders the header from live CDF data and proves the deep link
 * resolves to a real asset. Panels fetch independently so one unavailable CDF
 * capability never blanks the rest of the investigation.
 */
export function AssetDetailView({ asset, onBack }: AssetDetailViewProps) {
  return (
    <section
      aria-labelledby="asset-detail-heading"
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6"
    >
      <AssetHeader asset={asset} onBack={onBack} />
      <TimeSeriesPanel asset={asset} />
      <ActivitiesPanel asset={asset} />
      <DocumentsPanel asset={asset} />
    </section>
  );
}

function AssetHeader({ asset, onBack }: AssetDetailViewProps) {
  const { status, asset: loaded, errorKind, refresh } = useAssetDetailViewModel(asset);

  /*
   * The tag is the identity an engineer recognizes, and it is known from the
   * route before CDF answers — so the heading never renders empty, and it
   * upgrades to the display name once the asset is read.
   */
  const heading = loaded?.name ?? asset.externalId;

  return (
    <Card>
        <CardHeader>
          <CardHeaderStart>
            <CardTitle as="h1" id="asset-detail-heading">
              {heading}
            </CardTitle>
            <CardDescription>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Plant tag</span>
                <Badge background variant="nordic">
                  {asset.externalId}
                </Badge>
                <span className="text-muted-foreground">in space</span>
                <Badge background variant="mountain">
                  {asset.space}
                </Badge>
              </span>
            </CardDescription>
          </CardHeaderStart>
          <CardHeaderEnd>
            <Button onClick={refresh} size="sm" variant="secondary">
              Refresh asset
            </Button>
          </CardHeaderEnd>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status === 'loading' && (
            <div aria-live="polite" className="flex items-center gap-3 text-muted-foreground" role="status">
              <Loader size={20} />
              <span>Loading asset...</span>
            </div>
          )}

          {status === 'ready' && (
            <>
              <p className="max-w-3xl text-muted-foreground">
                {loaded?.description ?? 'This asset has no description.'}
              </p>
              {loaded !== undefined && (
                <HierarchyContext asset={loaded} current={asset} />
              )}
            </>
          )}

          {status === 'missing' && (
            <EmptyState type="not-found">
              <EmptyStateTitle as="h2">Asset not found</EmptyStateTitle>
              <EmptyStateDescription>
                {asset.externalId} no longer exists in {asset.space}. It may have been deleted since
                this link was shared.
              </EmptyStateDescription>
            </EmptyState>
          )}

          {status === 'error' && (
            <Alert alertStyle="card" variant="error">
              <AlertTitle>Could not load this asset</AlertTitle>
              <AlertDescription>{ERROR_DESCRIPTIONS[errorKind ?? 'unknown']}</AlertDescription>
              <AlertActions>
                <AlertButton onClick={refresh} type="button">
                  Try again
                </AlertButton>
              </AlertActions>
            </Alert>
          )}

          <div>
            <Button onClick={onBack} variant="secondary">
              Back to search
            </Button>
          </div>
        </CardContent>
    </Card>
  );
}

function HierarchyContext({
  asset,
  current,
}: {
  asset: Asset;
  current: InstanceRef;
}) {
  const hierarchy = hierarchyPath(asset, current);
  if (hierarchy.length <= 1) return null;

  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-medium">Hierarchy</p>
      <Breadcrumb aria-label="Asset hierarchy">
        <BreadcrumbList>
          {hierarchy.map((item, index) => (
            <Fragment key={`${item.space}:${item.externalId}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                <BreadcrumbPage>{item.externalId}</BreadcrumbPage>
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

function hierarchyPath(asset: Asset, current: InstanceRef): InstanceRef[] {
  const context =
    asset.path !== undefined && asset.path.length > 0
      ? asset.path
      : uniqueRefs([asset.root, asset.parent]);
  const path = [...context];
  if (!path.some((item) => instanceRefEquals(item, current))) path.push(current);
  return path;
}

function uniqueRefs(
  refs: Array<InstanceRef | undefined>
): InstanceRef[] {
  const unique: InstanceRef[] = [];
  for (const ref of refs) {
    if (ref === undefined) continue;
    if (unique.some((item) => instanceRefEquals(item, ref))) continue;
    unique.push(ref);
  }
  return unique;
}
