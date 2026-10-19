import {
  Alert,
  AlertActions,
  AlertButton,
  AlertDescription,
  AlertTitle,
} from '@cognite/aura/components/alert';
import { getErrorMessage } from 'react-error-boundary';

type AppErrorFallbackProps = {
  /** Thrown value, typed `unknown` because anything can be thrown during render. */
  error: unknown;
  onReload: () => void;
};

/**
 * Recovery screen shown when the application-level boundary catches a render
 * exception (SPEC FR-021, AS-20, SC-010).
 *
 * A full reload is the only offered recovery: a render error is usually
 * deterministic, so retrying the same tree in place would fail again. Reloading
 * rebuilds the app from the URL the host already holds, which keeps the user's
 * deep-linked asset instead of dropping them somewhere else.
 */
export function AppErrorFallback({ error, onReload }: AppErrorFallbackProps) {
  const message = getErrorMessage(error);

  return (
    <main className="min-h-screen bg-muted/50 text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-4 sm:p-8">
        <Alert alertStyle="card" role="alert" variant="error">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            <p>Asset 360 ran into an unexpected problem and could not finish loading this screen.</p>
            <p className="pt-2">Reloading usually clears it. Your data in CDF has not been changed.</p>
            {message !== undefined && message.length > 0 && (
              <p className="pt-2 font-mono text-sm text-muted-foreground break-words">{message}</p>
            )}
          </AlertDescription>
          <AlertActions>
            <AlertButton onClick={onReload} type="button">
              Reload
            </AlertButton>
          </AlertActions>
        </Alert>
      </section>
    </main>
  );
}
