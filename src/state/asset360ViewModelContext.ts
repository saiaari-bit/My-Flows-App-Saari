import { createContext, useContext } from 'react';

import type { Asset360Service } from '../services/asset360Service';

import { useWorkspaceStorage } from './workspaceStorageContext';

/**
 * Dependencies the view models resolve through context, so tests can supply a
 * stub service and stub storage without touching the network.
 */
export type Asset360Deps = {
  service: Asset360Service | null;
  useWorkspaceStorage: typeof useWorkspaceStorage;
  /** Opens a document URL. Wired to the host's external navigation in the app. */
  openExternalUrl: (url: string) => Promise<void>;
  now: () => number;
};

const defaultDeps: Asset360Deps = {
  service: null,
  useWorkspaceStorage,
  openExternalUrl: async () => {
    console.error('Asset 360: no external navigation available in this context');
  },
  now: () => Date.now(),
};

export const Asset360DepsContext = createContext<Asset360Deps>(defaultDeps);

export function useAsset360Deps(): Asset360Deps {
  return useContext(Asset360DepsContext);
}
