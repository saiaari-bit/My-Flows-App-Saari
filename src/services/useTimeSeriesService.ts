import { useCogniteSdk } from '@cognite/app-sdk/react';
import { createContext, useContext, useMemo } from 'react';

import type {
  TimeSeriesService,
  TimeSeriesServiceClient,
} from './timeSeriesService';
import { CdmTimeSeriesService } from './timeSeriesService';

export type TimeSeriesServiceContextType = {
  useTimeSeriesService: () => TimeSeriesService;
  useCogniteSdk: () => TimeSeriesServiceClient;
};

function useCdmTimeSeriesService(): TimeSeriesService {
  const { useCogniteSdk } = useContext(TimeSeriesServiceContext);
  const client = useCogniteSdk();
  return useMemo(() => new CdmTimeSeriesService(client), [client]);
}

export const DEFAULT_TIME_SERIES_SERVICE_DEPS: TimeSeriesServiceContextType = {
  useTimeSeriesService: useCdmTimeSeriesService,
  useCogniteSdk,
};

/** Shared injection seam for linked-series and datapoint reads. */
export const TimeSeriesServiceContext = createContext<TimeSeriesServiceContextType>(
  DEFAULT_TIME_SERIES_SERVICE_DEPS
);

export function useTimeSeriesService(): TimeSeriesService {
  const deps = useContext(TimeSeriesServiceContext);
  return deps.useTimeSeriesService();
}
