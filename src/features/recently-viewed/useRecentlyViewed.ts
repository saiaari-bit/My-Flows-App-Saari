import { useContext } from 'react';

import { RecentlyViewedContext } from './RecentlyViewedContext';

export function useRecentlyViewed() {
  return useContext(RecentlyViewedContext);
}
