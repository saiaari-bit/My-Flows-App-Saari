import { createContext, useContext } from 'react';

import type { InstanceRef, TimeWindowId, WorkspaceTab } from '../domain/asset360Types';

import { DEFAULT_UI_STATE, type WorkspaceUiState } from './workspaceUiState';

/**
 * The single shared store for workspace UI state.
 *
 * View models read and write through this contract instead of holding
 * `useState` themselves, so every component that reads the workspace sees the
 * same selection.
 */
export type WorkspaceStorage = WorkspaceUiState & {
  selectAsset: (ref: InstanceRef | null) => void;
  setTab: (tab: WorkspaceTab) => void;
  setWindow: (window: TimeWindowId) => void;
  setQuery: (query: string) => void;
};

const notConnected = (): void => {
  console.error('Asset 360: workspace state used outside of Asset360StateProvider');
};

export const WorkspaceStorageContext = createContext<WorkspaceStorage>({
  ...DEFAULT_UI_STATE,
  selectAsset: notConnected,
  setTab: notConnected,
  setWindow: notConnected,
  setQuery: notConnected,
});

export function useWorkspaceStorage(): WorkspaceStorage {
  return useContext(WorkspaceStorageContext);
}
