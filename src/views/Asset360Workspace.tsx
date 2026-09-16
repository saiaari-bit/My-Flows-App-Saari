import { Card, CardContent } from '@cognite/aura/components/card';
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from '@cognite/aura/components/empty-state';
import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@cognite/aura/components/tabs';

import { WORKSPACE_TABS, type WorkspaceTab } from '../domain/asset360Types';
import { useAsset360ViewModel } from '../hooks/useAsset360ViewModel';

import { AssetSearchControl } from './AssetSearchControl';
import { AssetSummaryBar } from './AssetSummaryBar';
import { DocumentsPanel } from './DocumentsPanel';
import { SignalsPanel } from './SignalsPanel';
import { WorkOrdersPanel } from './WorkOrdersPanel';

const TAB_LABELS: Record<WorkspaceTab, string> = {
  signals: 'Time series',
  workOrders: 'Work orders',
  documents: 'Documents',
};

/**
 * The investigation workspace: one compact header, the asset's identity, and
 * three panels that load independently.
 */
export function Asset360Workspace() {
  const viewModel = useAsset360ViewModel();
  const hasSelection = viewModel.selected !== null;

  return (
    <main className="min-h-screen bg-muted/40 text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-medium tracking-tight">Asset 360 Investigation Workspace</h1>
            <p className="text-sm text-muted-foreground">
              Signals, work orders, and documents for one asset, in one place.
            </p>
          </div>
          <AssetSearchControl selectedLabel={viewModel.asset.data?.label} />
        </header>

        {!hasSelection ? (
          <Card>
            <CardContent>
              <EmptyState variant="full" type="new-object">
                <EmptyStateIcon />
                <EmptyStateTitle>Start with an asset</EmptyStateTitle>
                <EmptyStateDescription>
                  Search for an equipment name or tag to see its process signals, work order history, and
                  related documents together.
                </EmptyStateDescription>
              </EmptyState>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent>
                <AssetSummaryBar state={viewModel.asset} />
              </CardContent>
            </Card>

            <Tabs
              value={viewModel.tab}
              onValueChange={(next: unknown) => {
                const match = WORKSPACE_TABS.find((candidate) => candidate === next);
                if (match !== undefined) {
                  viewModel.setTab(match);
                }
              }}
            >
              <TabsList aria-label="Investigation sections">
                {WORKSPACE_TABS.map((tab) => (
                  <TabsTrigger key={tab} value={tab} badge={countFor(tab, viewModel)}>
                    {TAB_LABELS[tab]}
                  </TabsTrigger>
                ))}
              </TabsList>

              <Card className="mt-4">
                <CardContent>
                  <TabsPanel value="signals">
                    <SignalsPanel viewModel={viewModel} />
                  </TabsPanel>
                  <TabsPanel value="workOrders">
                    <WorkOrdersPanel viewModel={viewModel} />
                  </TabsPanel>
                  <TabsPanel value="documents">
                    <DocumentsPanel viewModel={viewModel} />
                  </TabsPanel>
                </CardContent>
              </Card>
            </Tabs>
          </>
        )}
      </div>
    </main>
  );
}

/**
 * Count shown on a tab, so the analyst sees what exists before clicking.
 * Undefined while loading or on error, rather than a misleading zero.
 */
function countFor(tab: WorkspaceTab, viewModel: ReturnType<typeof useAsset360ViewModel>): number | undefined {
  switch (tab) {
    case 'signals':
      return viewModel.signals.data?.signals.length;
    case 'workOrders':
      return viewModel.workOrders.data?.length;
    case 'documents':
      return viewModel.documents.data?.length;
  }
}
