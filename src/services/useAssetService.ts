import { useCogniteSdk } from '@cognite/app-sdk/react';
import { createContext, useContext, useMemo } from 'react';

import type { AssetService, AssetServiceClient } from './assetService';
import { CdmAssetService } from './assetService';

/**
 * Dependencies of the asset read seam (AGENTS.md §3).
 *
 * `useCogniteSdk` is declared as the narrow `AssetServiceClient` rather than the
 * whole `CogniteClient`: it documents the exact surface this app uses, and it
 * lets a test hand over a three-member object instead of a cast-together SDK.
 */
export type AssetServiceContextType = {
  useAssetService: () => AssetService;
  useCogniteSdk: () => AssetServiceClient;
};

/**
 * Production wiring: one `CdmAssetService` per authenticated SDK client.
 *
 * The client comes from `CogniteSdkProvider` (AGENTS.md §8), so nothing below
 * this hook constructs a client or reads a base URL itself.
 */
function useCdmAssetService(): AssetService {
  const { useCogniteSdk } = useContext(AssetServiceContext);
  const client = useCogniteSdk();
  return useMemo(() => new CdmAssetService(client), [client]);
}

export const DEFAULT_ASSET_SERVICE_DEPS: AssetServiceContextType = {
  useAssetService: useCdmAssetService,
  useCogniteSdk,
};

/**
 * The single injection point for asset reads.
 *
 * It is shared by every view model that needs assets rather than duplicated per
 * view model, so a test — or a future host supplying its own implementation —
 * overrides one provider instead of one per screen.
 */
export const AssetServiceContext = createContext<AssetServiceContextType>(DEFAULT_ASSET_SERVICE_DEPS);

export function useAssetService(): AssetService {
  const deps = useContext(AssetServiceContext);
  return deps.useAssetService();
}
