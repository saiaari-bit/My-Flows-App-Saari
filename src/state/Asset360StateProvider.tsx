import type { HostAppAPI } from '@cognite/app-sdk';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { InstanceRef, TimeWindowId, WorkspaceTab } from '../domain/asset360Types';

import { WorkspaceStorageContext, type WorkspaceStorage } from './workspaceStorageContext';
import { parseWorkspaceUiState, serializeWorkspaceUiState, type WorkspaceUiState } from './workspaceUiState';

/** Only the host capability this provider needs. */
export type HostStateSync = Pick<HostAppAPI, 'syncInternalState'>;

type Asset360StateProviderProps = {
  children: ReactNode;
  /** The state string the host extracted from the URL on this load. */
  initialState?: string;
  /** `null` until the host handshake resolves, or when running outside Fusion. */
  api: HostStateSync | null;
};

/**
 * Holds the workspace UI state once, near the root, and mirrors every change to
 * the Fusion host so the URL stays shareable.
 *
 * This is the only place in the app that owns UI state; view models compose it.
 */
export function Asset360StateProvider({ children, initialState, api }: Asset360StateProviderProps) {
  const [state, setState] = useState<WorkspaceUiState>(() => parseWorkspaceUiState(initialState));

  // Kept in a ref so `push` never changes identity when the host connects
  // late. `push` only runs from event handlers, after this effect has applied.
  const apiRef = useRef<HostStateSync | null>(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const push = useCallback((next: WorkspaceUiState) => {
    setState(next);
    const host = apiRef.current;
    if (host === null) {
      return;
    }
    void host.syncInternalState(serializeWorkspaceUiState(next)).catch((cause: unknown) => {
      console.error('Asset 360: failed to sync state to the Fusion host', cause);
    });
  }, []);

  const storage: WorkspaceStorage = useMemo(
    () => ({
      ...state,
      selectAsset: (ref: InstanceRef | null) => {
        // Reset to the default panel so a new asset always opens on its signals.
        push({ ...state, selected: ref, tab: 'signals' });
      },
      setTab: (tab: WorkspaceTab) => push({ ...state, tab }),
      setWindow: (window: TimeWindowId) => push({ ...state, window }),
      setQuery: (query: string) => push({ ...state, query }),
    }),
    [state, push]
  );

  return <WorkspaceStorageContext.Provider value={storage}>{children}</WorkspaceStorageContext.Provider>;
}
