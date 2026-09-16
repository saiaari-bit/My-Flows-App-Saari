import type { HostAppAPI, ConnectToHostAppResult } from '@cognite/app-sdk';
import { CogniteClient } from '@cognite/sdk';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { OperationsViewModelContext } from './context/OperationsViewModelContext';
import { emptySnapshot } from './domain/aggregateOperations';
import type { OperationsSnapshot, WorkflowExecutionRecord } from './domain/operationsTypes';
import type { OperationsService } from './services/operationsService';

type AppDeps = NonNullable<ComponentProps<typeof App>['deps']>;
type AppApi = Pick<HostAppAPI, 'syncInternalState'>;

function makeApi(): AppApi {
  return {
    syncInternalState: vi.fn<HostAppAPI['syncInternalState']>(() => Promise.resolve(true)),
  };
}

function makeConnectedFn(api: AppApi = makeApi()) {
  return vi.fn(() => Promise.resolve({ api }));
}

function makeDeps(): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() =>
      Promise.resolve({
        api: {
          getProject: vi.fn<HostAppAPI['getProject']>(() => Promise.resolve('celanse-dev')),
          getBaseUrl: vi.fn<HostAppAPI['getBaseUrl']>(() =>
            Promise.resolve('https://az-eastus-1.cognitedata.com'),
          ),
          getAccessToken: vi.fn<HostAppAPI['getAccessToken']>(() => Promise.resolve('test-token')),
          getAppId: vi.fn<HostAppAPI['getAppId']>(() => Promise.resolve('test-app-id')),
        } as Partial<HostAppAPI> as HostAppAPI,
      }),
    ),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

function makeLoadingDeps(): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(
      () => new Promise<ConnectToHostAppResult>(() => undefined),
    ),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

const sampleExecution: WorkflowExecutionRecord = {
  id: 'ex-1',
  workflowExternalId: 'wf-cnt-extract',
  version: '1',
  status: 'RUNNING',
  createdMs: 0,
  startMs: 0,
  endMs: null,
  tasks: [],
};

function snapshotWithRun(): OperationsSnapshot {
  return {
    ...emptySnapshot(10_000),
    executions: [sampleExecution],
  };
}

function renderApp(
  ui: Parameters<typeof render>[0],
  loadWindow: OperationsService['loadWindow'] = async () => emptySnapshot(10_000),
) {
  return render(
    <OperationsViewModelContext.Provider
      value={{
        createService: () => ({ loadWindow }),
        nowMs: () => 10_000,
      }}
    >
      {ui}
    </OperationsViewModelContext.Provider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    renderApp(
      <App deps={makeLoadingDeps()} connectToHostApp={() => new Promise<never>(() => undefined)} />,
    );
    expect(screen.getByText('Loading project...')).toBeInTheDocument();
  });

  it('renders the operations dashboard for the connected project', async () => {
    renderApp(<App deps={makeDeps()} connectToHostApp={makeConnectedFn()} />);
    await waitFor(() => expect(screen.getByText('CDF workflow operations')).toBeInTheDocument());
    expect(screen.getByText(/celanse-dev/)).toBeInTheDocument();
    expect(screen.getByText(/Estimated analog/)).toBeInTheDocument();
    expect(screen.getByText('Overall analog cost (24h)')).toBeInTheDocument();
    expect(screen.getByText('Functions')).toBeInTheDocument();
    expect(screen.getByText('Transformations')).toBeInTheDocument();
  });

  it('syncs selected execution to the host', async () => {
    const api = makeApi();
    renderApp(
      <App deps={makeDeps()} connectToHostApp={makeConnectedFn(api)} />,
      async () => snapshotWithRun(),
    );
    await waitFor(() => expect(screen.getAllByText('wf-cnt-extract').length).toBeGreaterThan(0));
    await userEvent.click(screen.getAllByText('wf-cnt-extract')[0]);
    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ selectedExecutionId: 'ex-1', tab: 'overview' }),
    );
  });
});
