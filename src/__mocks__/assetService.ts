import { vi } from 'vitest';

import type { Asset, AssetService } from '@/services/assetService';

/**
 * Shared stub for the asset read seam (AGENTS.md §6).
 *
 * Both methods resolve to "nothing found" by default, so a test only
 * reconfigures the call it actually exercises.
 */
export function createAssetServiceStub() {
  return {
    searchAssets: vi.fn<AssetService['searchAssets']>(() => Promise.resolve([])),
    getAsset: vi.fn<AssetService['getAsset']>(() => Promise.resolve(null)),
  };
}

export type AssetServiceStub = ReturnType<typeof createAssetServiceStub>;

export function makeAsset(externalId: string, overrides: Partial<Asset> = {}): Asset {
  return { space: 'my-space', externalId, ...overrides };
}
