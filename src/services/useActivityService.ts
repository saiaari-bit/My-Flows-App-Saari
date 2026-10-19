import { useCogniteSdk } from '@cognite/app-sdk/react';
import { createContext, useContext, useMemo } from 'react';

import type { ActivityService, ActivityServiceClient } from './activityService';
import { CdmActivityService } from './activityService';

export type ActivityServiceContextType = {
  useActivityService: () => ActivityService;
  useCogniteSdk: () => ActivityServiceClient;
};

function useCdmActivityService(): ActivityService {
  const { useCogniteSdk } = useContext(ActivityServiceContext);
  const client = useCogniteSdk();
  return useMemo(() => new CdmActivityService(client), [client]);
}

export const DEFAULT_ACTIVITY_SERVICE_DEPS: ActivityServiceContextType = {
  useActivityService: useCdmActivityService,
  useCogniteSdk,
};

/** Shared injection seam for linked activity reads. */
export const ActivityServiceContext = createContext<ActivityServiceContextType>(
  DEFAULT_ACTIVITY_SERVICE_DEPS
);

export function useActivityService(): ActivityService {
  const deps = useContext(ActivityServiceContext);
  return deps.useActivityService();
}
