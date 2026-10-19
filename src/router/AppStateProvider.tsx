import type { ReactNode } from 'react';
import { useMemo, useReducer } from 'react';

import { AppStateContext } from './AppStateContext';
import { routeReducer } from './routeState';

import { parseAppState } from '@/host/hostState';
import { useHostApp } from '@/host/useHostApp';


type AppStateProviderProps = {
  children: ReactNode;
};

/**
 * Seeds route state from the host's `initialState` and shares it with the view
 * tree. Rendered once, above everything that reads the route.
 *
 * Seeding happens in the reducer initializer rather than an effect so the first
 * paint already reflects the deep link — a shared URL never flashes the search
 * view before landing on the asset (SPEC FR-003, AS-4).
 */
export function AppStateProvider({ children }: AppStateProviderProps) {
  const { initialState } = useHostApp();
  const [state, dispatch] = useReducer(routeReducer, initialState, parseAppState);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
