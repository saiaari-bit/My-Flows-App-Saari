import type { HostAppAPI } from '@cognite/app-sdk';
import { createContext } from 'react';

/**
 * Narrow slice of the Fusion `HostAppAPI` this app depends on.
 *
 * Phase 1 only needs the host-synced state channel; keeping the interface
 * narrow (AGENTS.md §3) means tests supply one function instead of stubbing the
 * whole host surface, and widening it later is an explicit decision.
 */
export type HostAppApi = Pick<
  HostAppAPI,
  'navigateExternal' | 'syncInternalState'
> &
  Partial<Pick<HostAppAPI, 'getProject'>>;

export type HostAppContextValue = {
  /** `null` until the host connection resolves, or when running outside Fusion. */
  api: HostAppApi | null;
  /** Raw serialized state the host recovered from the URL on this load. */
  initialState?: string;
};

export const DEFAULT_HOST_APP_CONTEXT: HostAppContextValue = {
  api: null,
  initialState: undefined,
};

export const HostAppContext = createContext<HostAppContextValue>(DEFAULT_HOST_APP_CONTEXT);
