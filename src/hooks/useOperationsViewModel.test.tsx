import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  OperationsStorageContext,
  type OperationsStorage,
} from '../context/operationsStorageContext';
import { OperationsViewModelContext } from '../context/OperationsViewModelContext';
import { emptySnapshot } from '../domain/aggregateOperations';
import type { OperationsSnapshot } from '../domain/operationsTypes';

import { useOperationsViewModel } from './useOperationsViewModel';

function wrapperWith(snapshot: OperationsSnapshot, extra?: Partial<OperationsStorage>) {
  const storage: OperationsStorage = {
    snapshot,
    isLoading: false,
    ui: { selectedExecutionId: null, tab: 'overview' },
    project: 'celanse-dev',
    selectExecution: () => undefined,
    setTab: () => undefined,
    reload: () => undefined,
    ...extra,
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <OperationsViewModelContext.Provider
        value={{
          createService: () => ({ loadWindow: async () => snapshot }),
          nowMs: () => 10_000,
        }}
      >
        <OperationsStorageContext.Provider value={storage}>{children}</OperationsStorageContext.Provider>
      </OperationsViewModelContext.Provider>
    );
  };
}

describe('useOperationsViewModel', () => {
  it('exposes loading from storage', () => {
    const { result } = renderHook(() => useOperationsViewModel(), {
      wrapper: wrapperWith(emptySnapshot(10_000), { isLoading: true }),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('splits analog cost for functions and transformations', () => {
    const snapshot: OperationsSnapshot = {
      ...emptySnapshot(10_000),
      functionCalls: [
        {
          id: 'c1',
          functionId: 1,
          functionExternalId: 'fn',
          status: 'COMPLETED',
          startMs: 0,
          endMs: 1000,
          memoryGb: 2,
        },
      ],
      transformationJobs: [
        {
          id: 1,
          transformationId: 2,
          transformationExternalId: 'tr',
          status: 'COMPLETED',
          startMs: 0,
          endMs: 3_600_000,
        },
      ],
    };
    const { result } = renderHook(() => useOperationsViewModel(), {
      wrapper: wrapperWith(snapshot),
    });
    expect(result.current.cost.transformationsUsd).toBeCloseTo(0.6);
    expect(result.current.cost.totalUsd).toBeCloseTo(
      result.current.cost.functionsUsd + result.current.cost.transformationsUsd,
    );
  });

  it('surfaces the error list from the snapshot', () => {
    const snapshot = { ...emptySnapshot(10_000), sourceErrors: ['Workflows: 403'] };
    const { result } = renderHook(() => useOperationsViewModel(), {
      wrapper: wrapperWith(snapshot),
    });
    expect(result.current.sourceErrors).toEqual(['Workflows: 403']);
  });
});
