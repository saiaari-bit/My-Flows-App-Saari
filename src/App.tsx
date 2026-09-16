import { connectToHostApp as connectToHostAppImpl } from '@cognite/app-sdk';
import type { HostAppAPI } from '@cognite/app-sdk';
import { CogniteSdkProvider, useCogniteSdk } from '@cognite/app-sdk/react';
import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { Card, CardContent } from '@cognite/aura/components/card';
import { Loader } from '@cognite/aura/components/loader';
import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';

import appConfig from '../app.json';

import { OperationsStateProvider } from './context/OperationsStateProvider';
import { OperationsDashboard } from './views/OperationsDashboard';

type AppApi = Pick<HostAppAPI, 'syncInternalState'>;
type AppConnectResult = { api: AppApi; initialState?: string };

function defaultConnectToHostApp(): Promise<AppConnectResult> {
  return connectToHostAppImpl({ applicationName: appConfig.externalId });
}

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

type AppContentProps = { api: AppApi | null; initialState?: string };

function AppContent({ api, initialState }: AppContentProps) {
  const client = useCogniteSdk();

  return (
    <OperationsStateProvider api={api} initialState={initialState} http={client}>
      <OperationsDashboard />
    </OperationsStateProvider>
  );
}

type AppProps = {
  deps?: ComponentProps<typeof CogniteSdkProvider>['deps'];
  connectToHostApp?: () => Promise<AppConnectResult>;
};

function App({
  deps,
  connectToHostApp = deps?.connectToHostApp ?? defaultConnectToHostApp,
}: AppProps) {
  const [connection, setConnection] = useState<AppConnectResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void connectToHostApp().then((result) => {
      if (!cancelled) setConnection(result);
    });
    return () => {
      cancelled = true;
    };
  }, [connectToHostApp]);

  return (
    <CogniteSdkProvider loadingFallback={loadingFallback} errorFallback={errorFallback} deps={deps}>
      <AppContent api={connection?.api ?? null} initialState={connection?.initialState} />
    </CogniteSdkProvider>
  );
}

export default App;
