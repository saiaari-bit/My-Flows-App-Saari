import { createContext } from 'react';

import type { RouteAction } from './routeState';

import type { AppState } from '@/host/hostState';
import { DEFAULT_APP_STATE } from '@/host/hostState';


/**
 * Shared storage for host-synced route state.
 *
 * Route state lives here rather than inside `useAppRoute` so that every
 * component calling the view model observes the same value (AGENTS.md §5).
 */
export type AppStateContextValue = {
  state: AppState;
  dispatch: (action: RouteAction) => void;
};

export const DEFAULT_APP_STATE_CONTEXT: AppStateContextValue = {
  state: DEFAULT_APP_STATE,
  dispatch: () => undefined,
};

export const AppStateContext = createContext<AppStateContextValue>(DEFAULT_APP_STATE_CONTEXT);
