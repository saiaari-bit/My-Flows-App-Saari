import { createContext } from 'react';

import type { RecentlyViewedAsset } from './recentlyViewedRepository';

import type { InstanceRef } from '@/host/hostState';
import type { Asset } from '@/services/assetService';


export type RecentlyViewedContextValue = {
  assets: RecentlyViewedAsset[];
  record: (asset: Asset) => void;
  remove: (asset: InstanceRef) => void;
};

export const RecentlyViewedContext =
  createContext<RecentlyViewedContextValue>({
    assets: [],
    record: () => undefined,
    remove: () => undefined,
  });
