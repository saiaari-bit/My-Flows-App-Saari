import { createContext, useContext } from 'react';

import type { OperationsSnapshot } from '../domain/operationsTypes';

export type OpsTab = 'overview' | 'recommendations';

export type OpsUiState = {
  selectedExecutionId: string | null;
  tab: OpsTab;
};

export type OperationsStorage = {
  snapshot: OperationsSnapshot;
  isLoading: boolean;
  ui: OpsUiState;
  project: string;
  selectExecution: (id: string | null) => void;
  setTab: (tab: OpsTab) => void;
  reload: () => void;
};

export const OperationsStorageContext = createContext<OperationsStorage | null>(null);

export function useOperationsStorage(): OperationsStorage {
  const value = useContext(OperationsStorageContext);
  if (!value) {
    throw new Error('useOperationsStorage must be used inside OperationsStateProvider');
  }
  return value;
}
