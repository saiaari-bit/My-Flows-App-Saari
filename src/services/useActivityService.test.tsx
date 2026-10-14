import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ActivityServiceClient } from './activityService';
import type { InstanceListParams, InstanceListResponse } from './cdm';
import {
  ActivityServiceContext,
  DEFAULT_ACTIVITY_SERVICE_DEPS,
  useActivityService,
} from './useActivityService';

import { createActivityServiceStub } from '@/__mocks__/activityService';

describe(useActivityService.name, () => {
  it('builds and memoizes a CDM service from the injected SDK client', async () => {
    const client = makeClient();
    const { result, rerender } = renderHook(() => useActivityService(), {
      wrapper: makeWrapper({ useCogniteSdk: () => client }),
    });
    const first = result.current;

    await result.current.getAssetActivities({ space: 'sp', externalId: 'PUMP-1' });
    rerender();

    expect(client.instances.list).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(first);
  });

  it('returns the service supplied through the context', () => {
    const stub = createActivityServiceStub();

    const { result } = renderHook(() => useActivityService(), {
      wrapper: makeWrapper({ useActivityService: () => stub }),
    });

    expect(result.current).toBe(stub);
  });
});

function makeWrapper(
  overrides: Partial<typeof DEFAULT_ACTIVITY_SERVICE_DEPS>
) {
  const value = { ...DEFAULT_ACTIVITY_SERVICE_DEPS, ...overrides };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ActivityServiceContext.Provider value={value}>
        {children}
      </ActivityServiceContext.Provider>
    );
  };
}

function makeClient(): ActivityServiceClient {
  const list = vi.fn(
    (_params: InstanceListParams): Promise<InstanceListResponse> =>
      Promise.resolve({ items: [] })
  );
  return { instances: { list } };
}
