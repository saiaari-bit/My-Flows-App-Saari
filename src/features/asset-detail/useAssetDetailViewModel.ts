import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { useRecentlyViewed } from '@/features/recently-viewed/useRecentlyViewed';
import type { InstanceRef } from '@/host/hostState';
import type { Asset } from '@/services/assetService';
import type { ServiceErrorKind } from '@/services/cdfError';
import { toCdfServiceError } from '@/services/cdfError';
import { useAssetService } from '@/services/useAssetService';

export type AssetDetailViewModel = {
  status: 'loading' | 'ready' | 'missing' | 'error';
  /** Only set once the read succeeded; the header falls back to the route reference. */
  asset?: Asset;
  errorKind?: ServiceErrorKind;
  /** Manual re-read. Nothing else refetches, per SPEC FR-010. */
  refresh: () => void;
};

/**
 * View model for the Asset 360 header (SPEC FR-005).
 *
 * Asset data stays in TanStack Query, keyed by node identity. Re-renders and
 * additional consumers reuse the same cached read, while a response for an old
 * route remains isolated under the old key.
 */
export function useAssetDetailViewModel(assetId: InstanceRef): AssetDetailViewModel {
  const assetService = useAssetService();
  const { record, remove } = useRecentlyViewed();
  const { space, externalId } = assetId;

  const query = useQuery({
    queryKey: ['asset', space, externalId],
    queryFn: () => assetService.getAsset({ space, externalId }),
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const refetch = query.refetch;
  const refresh = useCallback(() => void refetch(), [refetch]);
  const status =
    query.status === 'pending'
      ? 'loading'
      : query.status === 'error'
        ? 'error'
        : query.data === null
          ? 'missing'
          : 'ready';

  useEffect(() => {
    if (query.status !== 'success') return;
    if (query.data === null) {
      remove({ space, externalId });
      return;
    }
    record(query.data);
  }, [externalId, query.data, query.status, record, remove, space]);

  return useMemo(
    () => ({
      status,
      asset: query.data ?? undefined,
      errorKind:
        query.error === null ? undefined : toCdfServiceError(query.error).kind,
      refresh,
    }),
    [status, query.data, query.error, refresh]
  );
}
