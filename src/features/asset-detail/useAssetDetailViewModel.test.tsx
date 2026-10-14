import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAssetDetailViewModel } from './useAssetDetailViewModel';

import type { AssetServiceStub } from '@/__mocks__/assetService';
import { createAssetServiceStub, makeAsset } from '@/__mocks__/assetService';
import { createTestQueryClient } from '@/__mocks__/queryClient';
import type { RecentlyViewedContextValue } from '@/features/recently-viewed/RecentlyViewedContext';
import { RecentlyViewedContext } from '@/features/recently-viewed/RecentlyViewedContext';
import { CdfServiceError } from '@/services/cdfError';
import { AssetServiceContext, DEFAULT_ASSET_SERVICE_DEPS } from '@/services/useAssetService';

const ASSET_ID = { space: 'my-space', externalId: 'PUMP-001' };

describe(useAssetDetailViewModel.name, () => {
  let assetService: AssetServiceStub;
  let recentlyViewed: RecentlyViewedContextValue;

  beforeEach(() => {
    assetService = createAssetServiceStub();
    recentlyViewed = {
      assets: [],
      record: vi.fn(),
      remove: vi.fn(),
    };
  });

  it('reports a loading state while the asset is being read', () => {
    assetService.getAsset.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useAssetDetailViewModel(ASSET_ID), { wrapper: makeWrapper() });

    expect(result.current.status).toBe('loading');
    expect(assetService.getAsset).toHaveBeenCalledWith(ASSET_ID);
  });

  it('exposes the retrieved asset', async () => {
    const asset = makeAsset('PUMP-001', { name: 'Feed water pump', description: 'Boiler feed' });
    assetService.getAsset.mockResolvedValue(asset);

    const { result } = renderHook(() => useAssetDetailViewModel(ASSET_ID), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.asset).toEqual(asset);
  });

  it('records an asset only after its detail read succeeds', async () => {
    const asset = makeAsset('PUMP-001', {
      name: 'Feed water pump',
      description: 'Boiler feed',
    });
    assetService.getAsset.mockResolvedValue(asset);

    const { result } = renderHook(() => useAssetDetailViewModel(ASSET_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(recentlyViewed.record).toHaveBeenCalledWith(asset);
  });

  it('reports a deleted or unreachable asset as missing rather than failed', async () => {
    assetService.getAsset.mockResolvedValue(null);

    const { result } = renderHook(() => useAssetDetailViewModel(ASSET_ID), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect(result.current.errorKind).toBeUndefined();
    expect(recentlyViewed.remove).toHaveBeenCalledWith(ASSET_ID);
  });

  it('classifies a failed read so the view can explain it', async () => {
    assetService.getAsset.mockRejectedValue(
      new CdfServiceError('Insufficient access rights', { kind: 'no-access', status: 403 })
    );

    const { result } = renderHook(() => useAssetDetailViewModel(ASSET_ID), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorKind).toBe('no-access');
    expect(recentlyViewed.record).not.toHaveBeenCalled();
    expect(recentlyViewed.remove).not.toHaveBeenCalled();
  });

  it('re-reads the asset when the user refreshes', async () => {
    // Arrange
    assetService.getAsset.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAssetDetailViewModel(ASSET_ID), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.status).toBe('error'));

    // Act
    assetService.getAsset.mockResolvedValue(makeAsset('PUMP-001', { name: 'Feed water pump' }));
    await act(async () => result.current.refresh());

    // Assert
    expect(assetService.getAsset).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('reads the asset once for a reference that is recreated on every render', async () => {
    assetService.getAsset.mockResolvedValue(makeAsset('PUMP-001'));
    const { result, rerender } = renderHook(
      () => useAssetDetailViewModel({ space: ASSET_ID.space, externalId: ASSET_ID.externalId }),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender();

    expect(assetService.getAsset).toHaveBeenCalledTimes(1);
  });

  it('does not let a late response for an old asset overwrite the current header', async () => {
    let resolveOld: (asset: ReturnType<typeof makeAsset>) => void = () => undefined;
    assetService.getAsset
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockResolvedValueOnce(makeAsset('VALVE-9', { name: 'Bypass valve' }));
    const { result, rerender } = renderHook(
      ({ asset }) => useAssetDetailViewModel(asset),
      { initialProps: { asset: ASSET_ID }, wrapper: makeWrapper() }
    );

    rerender({ asset: { space: 'my-space', externalId: 'VALVE-9' } });
    await waitFor(() => expect(result.current.asset?.name).toBe('Bypass valve'));
    act(() => resolveOld(makeAsset('PUMP-001', { name: 'Feed water pump' })));

    expect(result.current.asset?.name).toBe('Bypass valve');
  });

  function makeWrapper() {
    const queryClient = createTestQueryClient();
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <RecentlyViewedContext.Provider value={recentlyViewed}>
            <AssetServiceContext.Provider
              value={{ ...DEFAULT_ASSET_SERVICE_DEPS, useAssetService: () => assetService }}
            >
              {children}
            </AssetServiceContext.Provider>
          </RecentlyViewedContext.Provider>
        </QueryClientProvider>
      );
    };
  }
});
