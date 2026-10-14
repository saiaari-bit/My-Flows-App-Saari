import { connectToHostApp as connectToHostAppImpl } from '@cognite/app-sdk';
import { CogniteSdkProvider } from '@cognite/app-sdk/react';
// Import per-component, not from the `@cognite/aura/components` barrel: the
// barrel pulls in Aura's whole dependency graph (including large libraries like
// mermaid and shiki), which slows the build and can exhaust memory in CI.
import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { Card, CardContent } from '@cognite/aura/components/card';
import { Loader } from '@cognite/aura/components/loader';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';

import appConfig from '../app.json';

import type { AppErrorBoundaryDeps } from '@/errors/AppErrorBoundary';
import { AppErrorBoundary } from '@/errors/AppErrorBoundary';
import { RecentlyViewedProvider } from '@/features/recently-viewed/RecentlyViewedProvider';
import type { HostAppApi } from '@/host/HostAppContext';
import { HostAppContext } from '@/host/HostAppContext';
import { AppRouter } from '@/router/AppRouter';
import { AppStateProvider } from '@/router/AppStateProvider';

type AppConnectResult = { api: HostAppApi; initialState?: string };
type AppConnection = AppConnectResult & { project: string };

const loadingFallback = (
  <main className="min-h-screen bg-muted/50 text-foreground">
    <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-4 sm:p-8">
      <div className="mx-auto w-full max-w-sm">
        <Card aria-label="Loading project" aria-live="polite">
          <CardContent>
            <div className="inline-flex items-center gap-3 text-muted-foreground">
              <Loader size={20} />
              <span>Loading project...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </main>
);

const errorFallback = (
  <main className="min-h-screen bg-muted/50 text-foreground">
    <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-4 sm:p-8">
      <div className="mx-auto w-full max-w-sm">
        <Alert>
          <AlertDescription>Failed to connect to Fusion host</AlertDescription>
        </Alert>
      </div>
    </section>
  </main>
);

type AppProps = {
  deps?: ComponentProps<typeof CogniteSdkProvider>['deps'];
  connectToHostApp?: () => Promise<AppConnectResult>;
  errorBoundaryDeps?: Partial<AppErrorBoundaryDeps>;
};

function connectWithApplicationName(): Promise<AppConnectResult> {
  return connectToHostAppImpl({ applicationName: appConfig.externalId });
}

function App({
  deps,
  connectToHostApp = deps?.connectToHostApp ?? connectWithApplicationName,
  errorBoundaryDeps,
}: AppProps) {
  const [connection, setConnection] = useState<AppConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    void connectToHostApp().then(async (result) => {
      const project = await readProject(result.api);
      if (!cancelled) setConnection({ ...result, project });
    });
    return () => {
      cancelled = true;
    };
  }, [connectToHostApp]);

  const hostApp = useMemo(
    () =>
      connection === null
        ? null
        : {
            api: connection.api,
            initialState: connection.initialState,
            project: connection.project,
          },
    [connection]
  );

  return (
    // Outermost so a render exception anywhere below — including in the SDK
    // provider or the host wiring — still produces a recoverable screen.
    <AppErrorBoundary deps={errorBoundaryDeps}>
      <CogniteSdkProvider loadingFallback={loadingFallback} errorFallback={errorFallback} deps={deps}>
        {hostApp === null ? (
          // Route state is seeded once from the host's initialState, so the tree
          // below must not mount until that value is available — otherwise a
          // shared deep link would render the search view and never recover.
          loadingFallback
        ) : (
          <HostAppContext.Provider value={hostApp}>
            <RecentlyViewedProvider project={hostApp.project}>
              <AppStateProvider>
                <main className="min-h-screen bg-muted/50 text-foreground">
                  <AppRouter />
                </main>
              </AppStateProvider>
            </RecentlyViewedProvider>
          </HostAppContext.Provider>
        )}
      </CogniteSdkProvider>
    </AppErrorBoundary>
  );
}

async function readProject(api: HostAppApi): Promise<string> {
  if (api.getProject === undefined) return 'standalone';
  try {
    return await api.getProject();
  } catch {
    return 'standalone';
  }
}

export default App;
