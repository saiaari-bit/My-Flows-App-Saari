import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, type RenderHookResult, type RenderResult } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { vi } from 'vitest';

import { Asset360StateProvider, type HostStateSync } from '../state/Asset360StateProvider';
import { Asset360DepsContext, type Asset360Deps } from '../state/asset360ViewModelContext';
import { useWorkspaceStorage } from '../state/workspaceStorageContext';

import { FIXTURE_NOW, stubAsset360Service, type StubAsset360Service } from './asset360Fixtures';

export type WorkspaceHarness = {
  service: StubAsset360Service;
  hostApi: { syncInternalState: ReturnType<typeof vi.fn<HostStateSync['syncInternalState']>> };
  openExternalUrl: ReturnType<typeof vi.fn<(url: string) => Promise<void>>>;
  /** Host state string this render was seeded with. */
  initialState?: string;
};

export type HarnessOptions = {
  service?: StubAsset360Service;
  initialState?: string;
  /** Simulates running with no Fusion host connected yet. */
  withoutHost?: boolean;
};

export function makeHarness(options: HarnessOptions = {}): WorkspaceHarness {
  return {
    service: options.service ?? stubAsset360Service(),
    hostApi: { syncInternalState: vi.fn(() => Promise.resolve(true)) },
    openExternalUrl: vi.fn(() => Promise.resolve()),
    initialState: options.initialState,
  };
}

/**
 * Wraps a tree in the same providers the app uses: a fresh query cache, the
 * shared workspace state, and injected dependencies. Retries are off so an
 * error-path test fails fast instead of waiting on backoff.
 */
function makeWrapper(
  harness: WorkspaceHarness,
  options: HarnessOptions
): ComponentType<{ children: ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  const deps: Asset360Deps = {
    service: harness.service,
    useWorkspaceStorage,
    openExternalUrl: harness.openExternalUrl,
    now: () => FIXTURE_NOW,
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Asset360StateProvider
          api={options.withoutHost === true ? null : harness.hostApi}
          initialState={harness.initialState}
        >
          <Asset360DepsContext.Provider value={deps}>{children}</Asset360DepsContext.Provider>
        </Asset360StateProvider>
      </QueryClientProvider>
    );
  };
}

export function renderInWorkspace(
  ui: ReactNode,
  options: HarnessOptions = {}
): RenderResult & { harness: WorkspaceHarness } {
  const harness = makeHarness(options);
  const result = render(<>{ui}</>, { wrapper: makeWrapper(harness, options) });
  return { ...result, harness };
}

export function renderWorkspaceHook<T>(
  hook: () => T,
  options: HarnessOptions = {}
): RenderHookResult<T, unknown> & { harness: WorkspaceHarness } {
  const harness = makeHarness(options);
  const result = renderHook(hook, { wrapper: makeWrapper(harness, options) });
  return { ...result, harness };
}
