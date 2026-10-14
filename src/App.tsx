import { connectToHostApp as connectToHostAppImpl } from '@cognite/app-sdk';
import type { HostAppAPI } from '@cognite/app-sdk';
import { CogniteSdkProvider, useCogniteSdk } from '@cognite/app-sdk/react';
import { Alert, AlertDescription, AlertTitle } from '@cognite/aura/components/alert';
import { Card, CardContent } from '@cognite/aura/components/card';
import { Loader } from '@cognite/aura/components/loader';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';

import appConfig from '../app.json';

import { createAsset360Service } from './services/CdfAsset360Service';
import { Asset360StateProvider } from './state/Asset360StateProvider';
import { Asset360DepsContext, type Asset360Deps } from './state/asset360ViewModelContext';
import { useWorkspaceStorage } from './state/workspaceStorageContext';
import { Asset360Workspace } from './views/Asset360Workspace';

/** The host capabilities this app uses. */
type AppApi = Pick<HostAppAPI, 'syncInternalState' | 'navigateExternal'>;
type AppConnectResult = { api: AppApi; initialState?: string };

function defaultConnectToHostApp(): Promise<AppConnectResult> {
  return connectToHostAppImpl({ applicationName: appConfig.externalId });
}

const loadingFallback = (
  <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6 text-foreground">
    <Card aria-live="polite">
      <CardContent>
        <div className="inline-flex items-center gap-3 text-muted-foreground">
          <Loader size={20} />
          <span>Connecting to Cognite Data Fusion…</span>
        </div>
      </CardContent>
    </Card>
  </main>
);

const errorFallback = (
  <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6 text-foreground">
    <div className="w-full max-w-md">
      <Alert variant="error" alertStyle="card" role="alert">
        <AlertTitle>Could not connect to Cognite Data Fusion</AlertTitle>
        <AlertDescription>
          This app runs inside Fusion. Open it from Fusion and reload; if it keeps failing, check that you
          have access to this project.
        </AlertDescription>
      </Alert>
    </div>
  </main>
);

type WorkspaceProps = { api: AppApi };

/**
 * Builds the dependency graph once the CDF client exists, then hands it to the
 * view models through context.
 */
function Workspace({ api }: WorkspaceProps) {
  const client = useCogniteSdk();

  const deps = useMemo<Asset360Deps>(
    () => ({
      service: createAsset360Service(client),
      useWorkspaceStorage,
      // Document links are opened by the host: only it owns the browsing context.
      openExternalUrl: async (url: string) => {
        await api.navigateExternal({ url, openInNewTab: true });
      },
      now: () => Date.now(),
    }),
    [client, api]
  );

  return (
    <Asset360DepsContext.Provider value={deps}>
      <Asset360Workspace />
    </Asset360DepsContext.Provider>
  );
}

type AppProps = {
  deps?: ComponentProps<typeof CogniteSdkProvider>['deps'];
  connectToHostApp?: () => Promise<AppConnectResult>;
};

/** The handshake carries `initialState`, so nothing can mount before it lands. */
type Handshake =
  | { status: 'connecting' }
  | { status: 'ready'; connection: AppConnectResult }
  | { status: 'failed' };

function App({ deps, connectToHostApp = defaultConnectToHostApp }: AppProps) {
  const [handshake, setHandshake] = useState<Handshake>({ status: 'connecting' });

  useEffect(() => {
    let cancelled = false;
    void connectToHostApp()
      .then((connection) => {
        if (!cancelled) {
          setHandshake({ status: 'ready', connection });
        }
      })
      .catch((cause: unknown) => {
        console.error('Asset 360: Fusion host handshake failed', cause);
        if (!cancelled) {
          setHandshake({ status: 'failed' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [connectToHostApp]);

  if (handshake.status === 'connecting') {
    return loadingFallback;
  }
  if (handshake.status === 'failed') {
    return errorFallback;
  }

  const { api, initialState } = handshake.connection;
  return (
    <CogniteSdkProvider loadingFallback={loadingFallback} errorFallback={errorFallback} deps={deps}>
      <Asset360StateProvider api={api} initialState={initialState}>
        <Workspace api={api} />
      </Asset360StateProvider>
    </CogniteSdkProvider>
  );
}

export default App;
