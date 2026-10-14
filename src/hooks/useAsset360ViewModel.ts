import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { instanceKey } from '../cdm/properties';
import type {
  AssetSummary,
  ChartSeries,
  DocumentFile,
  InstanceRef,
  TimeWindowId,
  WorkOrder,
  WorkspaceTab,
} from '../domain/asset360Types';
import { resolveTimeWindow, type TimeWindow } from '../domain/timeWindow';
import type { Asset360Service, SignalsResult } from '../services/asset360Service';
import { useAsset360Deps } from '../state/asset360ViewModelContext';

import { errorMessageOf } from './errorMessageOf';

/** Uniform shape every panel renders from, so all panels behave identically. */
export type SectionState<T> = {
  isLoading: boolean;
  data: T | undefined;
  errorMessage: string | undefined;
  retry: () => void;
};

export type Asset360ViewModel = {
  selected: InstanceRef | null;
  tab: WorkspaceTab;
  setTab: (tab: WorkspaceTab) => void;
  windowId: TimeWindowId;
  setWindow: (window: TimeWindowId) => void;
  timeWindow: TimeWindow;
  asset: SectionState<AssetSummary | undefined>;
  signals: SectionState<SignalsResult>;
  chart: SectionState<ChartSeries[]>;
  workOrders: SectionState<WorkOrder[]>;
  documents: SectionState<DocumentFile[]>;
  /** Fetches a download URL and hands it to the host to open. */
  openDocument: (document: DocumentFile) => void;
  /** Instance key of the document currently being opened, if any. */
  openingDocumentKey: string | undefined;
  openDocumentErrorMessage: string | undefined;
  now: number;
};

/**
 * The investigation workspace: the selected asset plus its three panels.
 *
 * Safe to call from several components — the UI state comes from shared
 * context and the server state from the React Query cache. Each panel is its
 * own query, which is what makes them load in parallel, fail independently,
 * and never show data belonging to a previously selected asset: the asset's
 * space and external id are part of every query key.
 */
export function useAsset360ViewModel(): Asset360ViewModel {
  const { service, useWorkspaceStorage, openExternalUrl, now } = useAsset360Deps();
  const storage = useWorkspaceStorage();
  const selected = storage.selected;
  const assetKey = selected === null ? null : instanceKey(selected);

  const asset = useQuery({
    queryKey: ['asset360', 'asset', assetKey],
    queryFn: () => withService(service, (ready) => ready.getAsset(requireRef(selected))),
    enabled: service !== null && selected !== null,
  });

  const signals = useQuery({
    queryKey: ['asset360', 'signals', assetKey],
    queryFn: () => withService(service, (ready) => ready.getSignals(requireRef(selected))),
    enabled: service !== null && selected !== null,
  });

  const workOrders = useQuery({
    queryKey: ['asset360', 'workOrders', assetKey],
    queryFn: () => withService(service, (ready) => ready.getWorkOrders(requireRef(selected))),
    enabled: service !== null && selected !== null,
  });

  const documents = useQuery({
    queryKey: ['asset360', 'documents', assetKey],
    queryFn: () => withService(service, (ready) => ready.getDocuments(requireRef(selected))),
    enabled: service !== null && selected !== null,
  });

  // The chart depends on which signals came back, so its key lists them.
  const plottable = useMemo(
    () => (signals.data?.signals ?? []).filter((signal) => signal.kind === 'numeric'),
    [signals.data]
  );
  const plottableKeys = plottable.map((signal) => instanceKey(signal.ref)).join(',');

  const timeWindow = useMemo(() => resolveTimeWindow(storage.window, now()), [storage.window, now]);

  const chart = useQuery({
    queryKey: ['asset360', 'chart', assetKey, storage.window, plottableKeys],
    queryFn: () => withService(service, (ready) => ready.getChartSeries(plottable, timeWindow)),
    enabled: service !== null && selected !== null && plottable.length > 0,
  });

  const openMutation = useMutation({
    mutationFn: async (document: DocumentFile) => {
      if (service === null) {
        return;
      }
      const url = await service.getDocumentDownloadUrl(document.ref);
      await openExternalUrl(url);
    },
  });

  const { mutate: openDocumentMutate } = openMutation;
  const openDocument = useCallback(
    (document: DocumentFile) => openDocumentMutate(document),
    [openDocumentMutate]
  );

  const openingDocument = openMutation.isPending ? openMutation.variables : undefined;

  return {
    selected,
    tab: storage.tab,
    setTab: storage.setTab,
    windowId: storage.window,
    setWindow: storage.setWindow,
    timeWindow,
    asset: toSection(asset),
    signals: toSection(signals),
    chart: toSection(chart),
    workOrders: toSection(workOrders),
    documents: toSection(documents),
    openDocument,
    openingDocumentKey: openingDocument === undefined ? undefined : instanceKey(openingDocument.ref),
    openDocumentErrorMessage: errorMessageOf(openMutation.error),
    now: timeWindow.end,
  };
}

type QueryLike<T> = {
  isLoading: boolean;
  data: T | undefined;
  error: unknown;
  refetch: () => Promise<unknown>;
};

function toSection<T>(query: QueryLike<T>): SectionState<T> {
  return {
    isLoading: query.isLoading,
    data: query.data,
    errorMessage: errorMessageOf(query.error),
    retry: () => void query.refetch(),
  };
}

/**
 * Guards the two preconditions React Query's `enabled` already enforces, so the
 * query functions stay free of non-null assertions.
 */
function withService<T>(
  service: Asset360Service | null,
  call: (service: Asset360Service) => Promise<T>
): Promise<T> {
  if (service === null) {
    return Promise.reject(new Error('Asset 360: CDF client is not ready'));
  }
  return call(service);
}

function requireRef(ref: InstanceRef | null): InstanceRef {
  if (ref === null) {
    throw new Error('Asset 360: no asset is selected');
  }
  return ref;
}
