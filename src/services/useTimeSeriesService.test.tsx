import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { InstanceListParams, InstanceListResponse } from './cdm';
import type {
  DatapointsRetrieveParams,
  DatapointsRetrieveResult,
  LatestDatapointsParams,
  LatestDatapointsResult,
  TimeSeriesServiceClient,
} from './timeSeriesService';
import {
  DEFAULT_TIME_SERIES_SERVICE_DEPS,
  TimeSeriesServiceContext,
  useTimeSeriesService,
} from './useTimeSeriesService';

import { createTimeSeriesServiceStub } from '@/__mocks__/timeSeriesService';

describe(useTimeSeriesService.name, () => {
  it('builds and memoizes a CDM service from the injected SDK client', async () => {
    const client = makeClient();
    const { result, rerender } = renderHook(() => useTimeSeriesService(), {
      wrapper: makeWrapper({ useCogniteSdk: () => client }),
    });
    const first = result.current;

    await result.current.getAssetTimeSeries({ space: 'sp', externalId: 'PUMP-1' });
    rerender();

    expect(client.instances.list).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(first);
  });

  it('returns the service supplied through the context', () => {
    const stub = createTimeSeriesServiceStub();

    const { result } = renderHook(() => useTimeSeriesService(), {
      wrapper: makeWrapper({ useTimeSeriesService: () => stub }),
    });

    expect(result.current).toBe(stub);
  });
});

function makeWrapper(
  overrides: Partial<typeof DEFAULT_TIME_SERIES_SERVICE_DEPS>
) {
  const value = { ...DEFAULT_TIME_SERIES_SERVICE_DEPS, ...overrides };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TimeSeriesServiceContext.Provider value={value}>
        {children}
      </TimeSeriesServiceContext.Provider>
    );
  };
}

function makeClient(): TimeSeriesServiceClient {
  const list = vi.fn(
    (_params: InstanceListParams): Promise<InstanceListResponse> =>
      Promise.resolve({ items: [] })
  );
  const retrieveLatest = vi.fn(
    (..._params: LatestDatapointsParams): Promise<LatestDatapointsResult> =>
      Promise.resolve([])
  );
  const retrieve = vi.fn(
    (_params: DatapointsRetrieveParams): Promise<DatapointsRetrieveResult> =>
      Promise.resolve([])
  );
  return {
    instances: { list },
    datapoints: { retrieveLatest, retrieve },
  };
}
