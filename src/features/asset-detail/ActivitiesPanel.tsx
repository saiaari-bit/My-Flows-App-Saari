import {
  Alert,
  AlertActions,
  AlertButton,
  AlertDescription,
  AlertTitle,
} from '@cognite/aura/components/alert';
import { Badge } from '@cognite/aura/components/badge';
import { Button } from '@cognite/aura/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderEnd,
  CardHeaderStart,
  CardTitle,
} from '@cognite/aura/components/card';
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from '@cognite/aura/components/empty-state';
import { Loader } from '@cognite/aura/components/loader';

import { useActivitiesPanelViewModel } from './useActivitiesPanelViewModel';

import type { InstanceRef } from '@/host/hostState';
import type { AssetActivity } from '@/services/activityService';
import type { ServiceErrorKind } from '@/services/cdfError';
import { instanceIdKey } from '@/services/cdm';

const ERROR_DESCRIPTIONS: Record<ServiceErrorKind, string> = {
  'no-access': 'You do not have access to read linked activities for this asset.',
  transient: 'The linked activities could not be loaded. Try again in a moment.',
  unknown: 'The linked activities could not be loaded.',
};

export function ActivitiesPanel({ asset }: { asset: InstanceRef }) {
  const viewModel = useActivitiesPanelViewModel(asset);

  return (
    <Card aria-labelledby="activities-heading">
      <CardHeader>
        <CardHeaderStart>
          <CardTitle as="h2" id="activities-heading">
            Activities
          </CardTitle>
          <CardDescription>
            Activities linked to this asset in CogniteActivity.
          </CardDescription>
        </CardHeaderStart>
        <CardHeaderEnd>
          <Button onClick={viewModel.refresh} size="sm" variant="secondary">
            Refresh
          </Button>
        </CardHeaderEnd>
      </CardHeader>
      <CardContent>
        {viewModel.status === 'loading' && (
          <div
            aria-live="polite"
            className="flex items-center gap-3 text-muted-foreground"
            role="status"
          >
            <Loader size={20} />
            <span>Loading activities...</span>
          </div>
        )}

        {viewModel.status === 'error' && (
          <Alert alertStyle="card" variant="error">
            <AlertTitle>Could not load activities</AlertTitle>
            <AlertDescription>
              {ERROR_DESCRIPTIONS[viewModel.errorKind ?? 'unknown']}
            </AlertDescription>
            <AlertActions>
              <AlertButton onClick={viewModel.refresh} type="button">
                Try again
              </AlertButton>
            </AlertActions>
          </Alert>
        )}

        {viewModel.status === 'ready' && viewModel.activities.length === 0 && (
          <EmptyState type="no-results">
            <EmptyStateTitle as="h3">No linked activities</EmptyStateTitle>
            <EmptyStateDescription>
              This asset has no CogniteActivity instances linked through its assets
              relation.
            </EmptyStateDescription>
          </EmptyState>
        )}

        {viewModel.status === 'ready' && viewModel.activities.length > 0 && (
          <ul aria-label="Linked activities" className="grid min-w-0 gap-3 lg:grid-cols-2">
            {viewModel.activities.map((activity) => (
              <li className="min-w-0 rounded-md border p-4" key={instanceIdKey(activity)}>
                <ActivitySummary activity={activity} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivitySummary({ activity }: { activity: AssetActivity }) {
  const timestamps = activityTimestamps(activity);

  return (
    <article className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="truncate font-medium">{activity.name ?? activity.externalId}</h3>
        <Badge background variant="nordic">
          {activity.externalId}
        </Badge>
      </div>
      {activity.description !== undefined && (
        <p className="mt-2 break-words text-sm text-muted-foreground">
          {activity.description}
        </p>
      )}
      {timestamps.length > 0 && (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {timestamps.map(({ label, timestamp }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm">
                <time dateTime={toIsoTimestamp(timestamp)}>
                  {toIsoTimestamp(timestamp)}
                </time>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

function activityTimestamps(
  activity: AssetActivity
): Array<{ label: string; timestamp: number }> {
  const timestamps: Array<{ label: string; timestamp: number }> = [];
  addTimestamp(timestamps, 'Scheduled start', activity.scheduledStartTime);
  addTimestamp(timestamps, 'Scheduled end', activity.scheduledEndTime);
  addTimestamp(timestamps, 'Actual start', activity.startTime);
  addTimestamp(timestamps, 'Actual end', activity.endTime);
  return timestamps;
}

function addTimestamp(
  timestamps: Array<{ label: string; timestamp: number }>,
  label: string,
  timestamp: number | undefined
): void {
  if (timestamp !== undefined) timestamps.push({ label, timestamp });
}

function toIsoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}
