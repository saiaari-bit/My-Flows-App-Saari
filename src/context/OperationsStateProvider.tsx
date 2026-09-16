import type { HostAppAPI } from '@cognite/app-sdk';
import { useCogniteSdk } from '@cognite/app-sdk/react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { emptySnapshot } from '../domain/aggregateOperations';
import type { OperationsSnapshot } from '../domain/operationsTypes';
import type { CdfHttp } from '../services/operationsService';

import {
  OperationsStorageContext,
  type OperationsStorage,
  type OpsTab,
  type OpsUiState,
} from './operationsStorageContext';
import { useOperationsDeps } from './OperationsViewModelContext';

const DEFAULT_UI: OpsUiState = { selectedExecutionId: null, tab: 'overview' };

type HostSync = Pick<HostAppAPI, 'syncInternalState'>;

type ProviderProps = {
  children: ReactNode;
  initialState?: string;
  api: HostSync | null;
  http?: CdfHttp;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseUi(raw: string | undefined): OpsUiState {
  if (!raw) {
    return DEFAULT_UI;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return DEFAULT_UI;
    }
    const selected =
      typeof parsed.selectedExecutionId === 'string' ? parsed.selectedExecutionId : null;
    const tab = parsed.tab === 'recommendations' ? 'recommendations' : 'overview';
    return { selectedExecutionId: selected, tab };
  } catch {
    return DEFAULT_UI;
  }
}

export function OperationsStateProvider({ children, initialState, api, http }: ProviderProps) {
  const sdk = useCogniteSdk();
  const { createService, nowMs } = useOperationsDeps();
  const client = http ?? sdk;
  const [snapshot, setSnapshot] = useState<OperationsSnapshot>(() => emptySnapshot(nowMs()));
  const [isLoading, setIsLoading] = useState(true);
  const [ui, setUi] = useState<OpsUiState>(() => parseUi(initialState));

  const persist = useCallback(
    (next: OpsUiState) => {
      setUi(next);
      void api?.syncInternalState(JSON.stringify(next));
    },
    [api],
  );

  const applySnapshot = useCallback((next: OperationsSnapshot) => {
    setSnapshot(next);
    setIsLoading(false);
  }, []);

  const reload = useCallback(() => {
    setIsLoading(true);
    void createService(client)
      .loadWindow(nowMs())
      .then(applySnapshot)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to load operations data';
        applySnapshot({
          ...emptySnapshot(nowMs()),
          sourceErrors: [message],
        });
      });
  }, [applySnapshot, client, createService, nowMs]);

  useEffect(() => {
    let cancelled = false;
    void createService(client)
      .loadWindow(nowMs())
      .then((next) => {
        if (!cancelled) {
          applySnapshot(next);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load operations data';
        applySnapshot({
          ...emptySnapshot(nowMs()),
          sourceErrors: [message],
        });
      });
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, client, createService, nowMs]);

  const value = useMemo<OperationsStorage>(
    () => ({
      snapshot,
      isLoading,
      ui,
      project: sdk.project,
      selectExecution: (id: string | null) => persist({ ...ui, selectedExecutionId: id }),
      setTab: (tab: OpsTab) => persist({ ...ui, tab }),
      reload,
    }),
    [snapshot, isLoading, ui, sdk.project, persist, reload],
  );

  return <OperationsStorageContext.Provider value={value}>{children}</OperationsStorageContext.Provider>;
}
