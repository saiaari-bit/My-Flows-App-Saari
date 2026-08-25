import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAppAPI, ConnectToHostAppResult } from '@cognite/app-sdk';
import { CogniteClient } from '@cognite/sdk';
import type { ComponentProps } from 'react';

import App from './App';

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
          getProject: vi.fn<HostAppAPI['getProject']>(() => Promise.resolve('lervik-industries')),
          getBaseUrl: vi.fn<HostAppAPI['getBaseUrl']>(() => Promise.resolve('https://cognite.test')),
          getAccessToken: vi.fn<HostAppAPI['getAccessToken']>(() => Promise.resolve('test-token')),
          getAppId: vi.fn<HostAppAPI['getAppId']>(() => Promise.resolve('test-app-id')),
        } as Partial<HostAppAPI> as HostAppAPI,
      })
    ),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

function makeLoadingDeps(): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() => new Promise<ConnectToHostAppResult>(() => undefined)),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    render(<App deps={makeLoadingDeps()} connectToHostApp={() => new Promise<never>(() => undefined)} />);
    expect(screen.getByText('Loading project...')).toBeInTheDocument();
  });

  it('renders splash with deployment targets and checklist copy', async () => {
    render(<App deps={makeDeps()} connectToHostApp={makeConnectedFn()} />);
    await waitFor(() => expect(screen.getByText('Welcome to Flows custom apps')).toBeInTheDocument());
    expect(screen.getByText('App deployment checklist')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('Deploy')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Help & feedback')).toBeInTheDocument();
    expect(screen.getByText('Your app will deploy to')).toBeInTheDocument();
    expect(screen.getByText('org')).toBeInTheDocument();
    expect(screen.getByText('and project')).toBeInTheDocument();
    expect(screen.getByText('cog-demo')).toBeInTheDocument();
    expect(screen.getByText('lervik-industries')).toBeInTheDocument();
    expect(screen.getAllByText(/SPEC\.md/).length).toBeGreaterThan(0);
    expect(screen.getByText(/apps deploy --interactive/)).toBeInTheDocument();
  });

  it('syncs internal state when the open step changes', async () => {
    const api = makeApi();
    render(<App deps={makeDeps()} connectToHostApp={makeConnectedFn(api)} />);
    await waitFor(() => expect(screen.getByText('App deployment checklist')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Explore'));

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ openStep: 'Explore' })
    );
  });

  it('restores the open step from initial state', async () => {
    const api = makeApi();
    render(<App
      deps={makeDeps()}
      connectToHostApp={() => Promise.resolve({ api, initialState: JSON.stringify({ openStep: 'Deploy' }) })}
    />);
    await waitFor(() => expect(screen.getByText('App deployment checklist')).toBeInTheDocument());

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /deploy/i })).toHaveAttribute('aria-expanded', 'true')
    );
    expect(screen.getByRole('button', { name: /plan/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
