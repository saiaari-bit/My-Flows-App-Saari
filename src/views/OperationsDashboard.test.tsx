import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  OperationsStorageContext,
  type OperationsStorage,
} from '../context/operationsStorageContext';
import { OperationsViewModelContext } from '../context/OperationsViewModelContext';
import { emptySnapshot } from '../domain/aggregateOperations';
import type { OperationsSnapshot } from '../domain/operationsTypes';

import { OperationsDashboard } from './OperationsDashboard';

function renderDashboard(snapshot: OperationsSnapshot, extra?: Partial<OperationsStorage>) {
  const storage: OperationsStorage = {
    snapshot,
    isLoading: extra?.isLoading ?? false,
    ui: extra?.ui ?? { selectedExecutionId: null, tab: 'overview' },
    project: extra?.project ?? 'celanse-dev',
    selectExecution: extra?.selectExecution ?? (() => undefined),
    setTab: extra?.setTab ?? (() => undefined),
    reload: extra?.reload ?? (() => undefined),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <OperationsViewModelContext.Provider
      value={{
        createService: () => ({ loadWindow: async () => snapshot }),
        nowMs: () => 10_000,
      }}
    >
      <OperationsStorageContext.Provider value={storage}>{children}</OperationsStorageContext.Provider>
    </OperationsViewModelContext.Provider>
  );
  return render(<OperationsDashboard />, { wrapper });
}

describe('OperationsDashboard', () => {
  it('renders loading copy', () => {
    renderDashboard(emptySnapshot(10_000), { isLoading: true });
    expect(screen.getByText('Loading workflow operations...')).toBeInTheDocument();
  });

  it('renders empty live and 24h states', () => {
    renderDashboard(emptySnapshot(10_000));
    expect(screen.getByText('No workflows running')).toBeInTheDocument();
    expect(screen.getByText('No executions in this window')).toBeInTheDocument();
  });

  it('renders a running workflow', () => {
    const snapshot: OperationsSnapshot = {
      ...emptySnapshot(10_000),
      executions: [
        {
          id: 'ex-1',
          workflowExternalId: 'wf-live',
          version: '1',
          status: 'RUNNING',
          createdMs: 0,
          startMs: 0,
          endMs: null,
          tasks: [],
        },
      ],
    };
    renderDashboard(snapshot);
    expect(screen.getAllByText('wf-live').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
  });
});
