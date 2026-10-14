import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { InstanceRef } from '@/host/hostState';
import type { AssetActivity } from '@/services/activityService';
import type { ServiceErrorKind } from '@/services/cdfError';
import { toCdfServiceError } from '@/services/cdfError';
import { useActivityService } from '@/services/useActivityService';

export type ActivitiesPanelViewModel = {
  status: 'loading' | 'ready' | 'error';
  activities: AssetActivity[];
  errorKind?: ServiceErrorKind;
  refresh: () => void;
};

/**
 * Activity server state is isolated by asset identity. TanStack Query keeps a
 * late response under the old asset's key, so it cannot replace the current
 * panel and no activity data enters host-synced route state.
 */
export function useActivitiesPanelViewModel(
  assetId: InstanceRef
): ActivitiesPanelViewModel {
  const service = useActivityService();
  const { space, externalId } = assetId;
  const query = useQuery({
    queryKey: ['asset-activities', space, externalId],
    queryFn: () => service.getAssetActivities({ space, externalId }),
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
        : 'ready';

  return useMemo(
    () => ({
      status,
      activities: query.data ?? [],
      errorKind:
        query.error === null ? undefined : toCdfServiceError(query.error).kind,
      refresh,
    }),
    [status, query.data, query.error, refresh]
  );
}
