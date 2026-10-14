import { Alert, AlertActions, AlertButton, AlertDescription, AlertTitle } from '@cognite/aura/components/alert';
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from '@cognite/aura/components/empty-state';
import { Skeleton } from '@cognite/aura/components/skeleton';
import type { ReactNode } from 'react';

/** Rows of skeleton bars, sized to the table or chart they stand in for. */
export function PanelSkeleton({ rows = 5, label }: { rows?: number; label: string }) {
  return (
    // `status` both announces the wait and gives the label something to name:
    // an aria-label on a generic div is ignored by most screen readers.
    <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="error" alertStyle="card" role="alert">
      <AlertTitle>Could not load this section</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <AlertActions>
        <AlertButton onClick={onRetry}>Try again</AlertButton>
      </AlertActions>
    </Alert>
  );
}

export function PanelEmpty({ title, description }: { title: string; description: string }) {
  return (
    <EmptyState variant="compact" type="no-results" className="mx-auto py-8">
      <EmptyStateIcon />
      <EmptyStateTitle as="p">{title}</EmptyStateTitle>
      <EmptyStateDescription>{description}</EmptyStateDescription>
    </EmptyState>
  );
}

type PanelBodyProps<T> = {
  state: { isLoading: boolean; data: T | undefined; errorMessage: string | undefined; retry: () => void };
  skeletonLabel: string;
  skeletonRows?: number;
  isEmpty: (data: T) => boolean;
  emptyTitle: string;
  emptyDescription: string;
  children: (data: T) => ReactNode;
};

/**
 * Renders the loading / error / empty / populated states of one panel.
 *
 * Every panel goes through this so the analyst sees the same treatment
 * everywhere, and so a panel can fail without affecting its neighbours.
 */
export function PanelBody<T>({
  state,
  skeletonLabel,
  skeletonRows,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: PanelBodyProps<T>) {
  if (state.errorMessage !== undefined) {
    return <PanelError message={state.errorMessage} onRetry={state.retry} />;
  }
  if (state.isLoading || state.data === undefined) {
    return <PanelSkeleton rows={skeletonRows} label={skeletonLabel} />;
  }
  if (isEmpty(state.data)) {
    return <PanelEmpty title={emptyTitle} description={emptyDescription} />;
  }
  return <>{children(state.data)}</>;
}
