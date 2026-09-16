import type { ConnectToHostAppResult, HostAppAPI } from '@cognite/app-sdk';
import { CogniteClient } from '@cognite/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import appConfig from '../app.json';

import App from './App';

type AppProps = ComponentProps<typeof App>;
type ProviderDeps = NonNullable<AppProps['deps']>;

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('tells the user it is connecting while the handshake is pending', () => {
    renderApp({ deps: pendingDeps(), connectToHostApp: () => new Promise<never>(() => undefined) });

    expect(screen.getByText('Connecting to Cognite Data Fusion…')).toBeInTheDocument();
  });

  it('explains what to do when the host handshake fails', async () => {
    renderApp({ deps: failingDeps(), connectToHostApp: () => Promise.reject(new Error('no host')) });

    expect(
      await screen.findByText('Could not connect to Cognite Data Fusion')
    ).toBeInTheDocument();
  });

  it('opens the workspace ready for a search once connected', async () => {
    renderApp({ deps: connectedDeps(), connectToHostApp: connectFn() });

    expect(await screen.findByRole('heading', { name: 'Start with an asset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search for an asset' })).toBeInTheDocument();
  });

  it('identifies itself to the host with the external id from app.json', async () => {
    const connect = connectFn();
    renderApp({ deps: connectedDeps(), connectToHostApp: connect });

    await waitFor(() => expect(connect).toHaveBeenCalled());
    expect(appConfig.externalId).toBe('asset-360-investigation-workspace');
  });

  it('waits for the host handshake before mounting the workspace', async () => {
    // The handshake carries the state the host read from the URL. Mounting the
    // workspace first would seed it with defaults and lose a shared link.
    renderApp({ deps: connectedDeps(), connectToHostApp: () => new Promise<never>(() => undefined) });

    expect(await screen.findByText('Connecting to Cognite Data Fusion…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Start with an asset' })).not.toBeInTheDocument();
  });

  it('passes the state the host read from the URL to the workspace', async () => {
    const connect = connectFn('{"tab":"documents","window":"7d"}');

    renderApp({ deps: connectedDeps(), connectToHostApp: connect });

    await screen.findByRole('heading', { name: 'Start with an asset' });
    expect(await connect.mock.results[0]?.value).toMatchObject({
      initialState: '{"tab":"documents","window":"7d"}',
    });
  });
});

function renderApp(props: AppProps) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<App {...props} />, { wrapper });
}

function connectFn(initialState?: string) {
  return vi.fn(() =>
    Promise.resolve({
      api: {
        syncInternalState: vi.fn<HostAppAPI['syncInternalState']>(() => Promise.resolve(true)),
        navigateExternal: vi.fn<HostAppAPI['navigateExternal']>(() => Promise.resolve(true)),
      },
      initialState,
    })
  );
}

function connectedDeps(): ProviderDeps {
  return {
    connectToHostApp: vi.fn<ProviderDeps['connectToHostApp']>(() =>
      Promise.resolve({
        api: {
          getProject: vi.fn<HostAppAPI['getProject']>(() => Promise.resolve('publicdatacdm')),
          getBaseUrl: vi.fn<HostAppAPI['getBaseUrl']>(() => Promise.resolve('https://api.cognitedata.com')),
          getAccessToken: vi.fn<HostAppAPI['getAccessToken']>(() => Promise.resolve('test-token')),
          getAppId: vi.fn<HostAppAPI['getAppId']>(() => Promise.resolve('asset-360-investigation-workspace')),
        } as Partial<HostAppAPI> as HostAppAPI,
      })
    ),
    createClient: vi.fn<ProviderDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

function pendingDeps(): ProviderDeps {
  return {
    connectToHostApp: vi.fn<ProviderDeps['connectToHostApp']>(
      () => new Promise<ConnectToHostAppResult>(() => undefined)
    ),
    createClient: vi.fn<ProviderDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

function failingDeps(): ProviderDeps {
  return {
    connectToHostApp: vi.fn<ProviderDeps['connectToHostApp']>(() =>
      Promise.reject(new Error('handshake timed out'))
    ),
    createClient: vi.fn<ProviderDeps['createClient']>((config) => new CogniteClient(config)),
  };
}
