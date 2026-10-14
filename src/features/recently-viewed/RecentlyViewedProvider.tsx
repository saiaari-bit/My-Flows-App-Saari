import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { RecentlyViewedContext } from './RecentlyViewedContext';
import {
  LocalStorageRecentlyViewedRepository,
  getBrowserStorage,
} from './recentlyViewedRepository';
import type { RecentlyViewedRepository } from './recentlyViewedRepository';

import type { InstanceRef } from '@/host/hostState';
import type { Asset } from '@/services/assetService';

type RecentlyViewedProviderProps = {
  children: ReactNode;
  project?: string;
  repository?: RecentlyViewedRepository;
};

export function RecentlyViewedProvider({
  children,
  project = 'standalone',
  repository: repositoryOverride,
}: RecentlyViewedProviderProps) {
  const defaultRepository = useMemo(
    () => new LocalStorageRecentlyViewedRepository(getBrowserStorage(), project),
    [project]
  );
  const repository = repositoryOverride ?? defaultRepository;
  const [assets, setAssets] = useState(() => repository.list());

  const record = useCallback(
    (asset: Asset) => setAssets(repository.record(asset)),
    [repository]
  );
  const remove = useCallback(
    (asset: InstanceRef) => setAssets(repository.remove(asset)),
    [repository]
  );
  const value = useMemo(
    () => ({ assets, record, remove }),
    [assets, record, remove]
  );

  return (
    <RecentlyViewedContext.Provider value={value}>
      {children}
    </RecentlyViewedContext.Provider>
  );
}
