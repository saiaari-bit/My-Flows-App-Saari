import type { ErrorInfo, ReactNode } from 'react';
import { useCallback } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { ErrorBoundary } from 'react-error-boundary';

import { AppErrorFallback } from './AppErrorFallback';

/**
 * Side-effecting dependencies, injected so tests never touch browser globals
 * (AGENTS.md §3).
 */
export type AppErrorBoundaryDeps = {
  /** Full page reload. Deliberately not navigation — see `AppErrorFallback`. */
  reload: () => void;
  logError: (error: unknown, info: ErrorInfo) => void;
};

const defaultDeps: AppErrorBoundaryDeps = {
  reload: () => window.location.reload(),
  logError: (error, info) => {
    console.error('Unhandled application error:', error, info.componentStack);
  },
};

type AppErrorBoundaryProps = {
  children: ReactNode;
  deps?: Partial<AppErrorBoundaryDeps>;
};

/**
 * Application-level error boundary (SPEC FR-021).
 *
 * Sits above the whole tree so a render exception anywhere produces a
 * recoverable screen instead of a blank page. Per-panel failures are handled
 * separately in a later phase; this is the last resort, not the routine path.
 */
export function AppErrorBoundary({ children, deps }: AppErrorBoundaryProps) {
  const { reload, logError } = { ...defaultDeps, ...deps };

  const renderFallback = useCallback(
    ({ error }: FallbackProps) => <AppErrorFallback error={error} onReload={reload} />,
    [reload]
  );

  return (
    <ErrorBoundary fallbackRender={renderFallback} onError={logError}>
      {children}
    </ErrorBoundary>
  );
}
