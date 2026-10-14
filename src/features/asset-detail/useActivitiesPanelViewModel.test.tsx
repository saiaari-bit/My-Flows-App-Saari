import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useActivitiesPanelViewModel } from './useActivitiesPanelViewModel';

import type { ActivityServiceStub } from '@/__mocks__/activityService';
import {
  createActivityServiceStub,
  makeActivity,
} from '@/__mocks__/activityService';
import { createTestQueryClient } from '@/__mocks__/queryClient';
import { CdfServiceError } from '@/services/cdfError';
import {
  ActivityServiceContext,
  DEFAULT_ACTIVITY_SERVICE_DEPS,
} from '@/services/useActivityService';

const ASSET = { space: 'my-space', externalId: 'PUMP-001' };

describe(useActivitiesPanelViewModel.name, () => {
  let service: ActivityServiceStub;

  beforeEach(() => {
    service = createActivityServiceStub();
  });

  it('loads activities with the current asset identity', async () => {
    service.getAssetActivities.mockResolvedValue([
      makeActivity('WO-1', { name: 'Replace seal' }),
    ]);

    const { result } = renderHook(
      () => useActivitiesPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(service.getAssetActivities).toHaveBeenCalledWith(ASSET);
    expect(result.current.activities[0]?.name).toBe('Replace seal');
  });

  it('exposes loading and empty success states', async () => {
    let resolve: (activities: []) => void = () => undefined;
    service.getAssetActivities.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const { result } = renderHook(
      () => useActivitiesPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );
    expect(result.current.status).toBe('loading');

    act(() => resolve([]));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.activities).toEqual([]);
  });

  it('classifies an error and retries only when asked', async () => {
    service.getAssetActivities.mockRejectedValueOnce(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );
    const { result } = renderHook(
      () => useActivitiesPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorKind).toBe('no-access');
    expect(service.getAssetActivities).toHaveBeenCalledTimes(1);

    service.getAssetActivities.mockResolvedValue([
      makeActivity('WO-1', { name: 'Replace seal' }),
    ]);
    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(service.getAssetActivities).toHaveBeenCalledTimes(2);
  });

  it('does not display a late response for an old asset', async () => {
    let resolveOld: (activities: ReturnType<typeof makeActivity>[]) => void = () =>
      undefined;
    service.getAssetActivities
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockResolvedValueOnce([
        makeActivity('WO-VALVE', { name: 'Inspect valve' }),
      ]);
    const { result, rerender } = renderHook(
      ({ asset }) => useActivitiesPanelViewModel(asset),
      { initialProps: { asset: ASSET }, wrapper: makeWrapper() }
    );

    rerender({ asset: { space: 'my-space', externalId: 'VALVE-9' } });
    await waitFor(() => expect(result.current.activities[0]?.externalId).toBe('WO-VALVE'));
    act(() => resolveOld([makeActivity('WO-PUMP', { name: 'Inspect pump' })]));

    expect(result.current.activities[0]?.externalId).toBe('WO-VALVE');
  });

  function makeWrapper() {
    const queryClient = createTestQueryClient();
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <ActivityServiceContext.Provider
            value={{
              ...DEFAULT_ACTIVITY_SERVICE_DEPS,
              useActivityService: () => service,
            }}
          >
            {children}
          </ActivityServiceContext.Provider>
        </QueryClientProvider>
      );
    };
  }
});
