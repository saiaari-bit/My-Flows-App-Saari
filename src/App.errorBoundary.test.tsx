import type { HostAppAPI } from '@cognite/app-sdk';
import { CogniteClient } from '@cognite/sdk';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

// Forces real application content to fail during render. Lives in its own file
// because `vi.mock` is hoisted per module, and the Phase 1 suite in
// App.test.tsx must keep exercising the real router.
vi.mock('@/router/AppRouter', () => ({
  AppRouter: () => {
    throw new Error('Render exploded inside application content');
  },
}));

type AppDeps = NonNullable<ComponentProps<typeof App>['deps']>;

function makeDeps(): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() =>
      Promise.resolve({
        api: {
          getProject: vi.fn<HostAppAPI['getProject']>(() => Promise.resolve('publicdatacdm')),
          getBaseUrl: vi.fn<HostAppAPI['getBaseUrl']>(() => Promise.resolve('https://cognite.test')),
          getAccessToken: vi.fn<HostAppAPI['getAccessToken']>(() => Promise.resolve('test-token')),
          getAppId: vi.fn<HostAppAPI['getAppId']>(() => Promise.resolve('test-app-id')),
        } as Partial<HostAppAPI> as HostAppAPI,
      })
    ),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

type AppApi = Pick<HostAppAPI, 'navigateExternal' | 'syncInternalState'>;

function makeApi(): AppApi {
  return {
    navigateExternal: vi.fn<HostAppAPI['navigateExternal']>(() => Promise.resolve(true)),
    syncInternalState: vi.fn<HostAppAPI['syncInternalState']>(() => Promise.resolve(true)),
  };
}

function makeConnectedFn(api: AppApi = makeApi()) {
  return vi.fn(() => Promise.resolve({ api, initialState: undefined }));
}

describe('App error boundary', () => {
  beforeEach(() => {
    // React logs every caught render error; silence it so the output stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the application-level fallback when application content throws during render', async () => {
    render(
      <App
        deps={makeDeps()}
        connectToHostApp={makeConnectedFn()}
        errorBoundaryDeps={{ reload: vi.fn(), logError: vi.fn() }}
      />
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Render exploded inside application content')).toBeInTheDocument();
  });

  it('offers a reload action that performs a full page reload', async () => {
    const reload = vi.fn();
    render(
      <App
        deps={makeDeps()}
        connectToHostApp={makeConnectedFn()}
        errorBoundaryDeps={{ reload, logError: vi.fn() }}
      />
    );

    const reloadButton = await waitFor(() => screen.getByRole('button', { name: 'Reload' }));
    await userEvent.click(reloadButton);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not write host state from the fallback', async () => {
    const api = makeApi();
    render(
      <App
        deps={makeDeps()}
        connectToHostApp={makeConnectedFn(api)}
        errorBoundaryDeps={{ reload: vi.fn(), logError: vi.fn() }}
      />
    );

    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(api.syncInternalState).not.toHaveBeenCalled();
  });
});
