import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { Badge } from '@cognite/aura/components/badge';
import { Button } from '@cognite/aura/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cognite/aura/components/card';
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from '@cognite/aura/components/empty-state';
import { Loader } from '@cognite/aura/components/loader';
import { Separator } from '@cognite/aura/components/separator';

import type { ExecutionStatus, WorkflowTask } from '../domain/operationsTypes';
import { useOperationsViewModel } from '../hooks/useOperationsViewModel';

function statusBadge(status: ExecutionStatus) {
  if (status === 'RUNNING') {
    return (
      <Badge variant="inProgress" background>
        Running
      </Badge>
    );
  }
  if (status === 'COMPLETED') {
    return (
      <Badge variant="success" background>
        Completed
      </Badge>
    );
  }
  if (status === 'FAILED' || status === 'TIMED_OUT') {
    return (
      <Badge variant="error" background>
        {status === 'TIMED_OUT' ? 'Timed out' : 'Failed'}
      </Badge>
    );
  }
  return (
    <Badge variant="gray" background>
      {status}
    </Badge>
  );
}

function TaskRow({ task }: { task: WorkflowTask }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="truncate font-medium">{task.externalId}</div>
        <div className="text-sm text-muted-foreground">{task.kind}</div>
      </div>
      {statusBadge(task.status)}
    </div>
  );
}

export function OperationsDashboard() {
  const vm = useOperationsViewModel();

  if (vm.isLoading) {
    return (
      <main className="min-h-screen bg-muted/50 p-4 text-foreground sm:p-8">
        <Card aria-label="Loading operations" aria-live="polite">
          <CardContent>
            <div className="inline-flex items-center gap-3 text-muted-foreground">
              <Loader size={20} />
              <span>Loading workflow operations...</span>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/50 p-4 text-foreground sm:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">CDF workflow operations</h1>
            <p className="text-muted-foreground">
              Project <span className="font-medium text-foreground">{vm.project}</span> · live now and
              last 24 hours
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={vm.tab === 'overview' ? 'default' : 'secondary'}
              onClick={() => vm.setTab('overview')}
            >
              Overview
            </Button>
            <Button
              variant={vm.tab === 'recommendations' ? 'default' : 'secondary'}
              onClick={() => vm.setTab('recommendations')}
            >
              Recommendations
            </Button>
            <Button variant="outline" onClick={() => vm.reload()}>
              Refresh
            </Button>
          </div>
        </div>

        <Alert variant="info">
          <AlertDescription>{vm.disclaimer}</AlertDescription>
        </Alert>

        {vm.sourceErrors.map((message) => (
          <Alert key={message} variant="warning">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ))}

        {vm.tab === 'overview' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardDescription>Overall analog cost (24h)</CardDescription>
                  <CardTitle as="h2">{vm.costLabels.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Functions</CardDescription>
                  <CardTitle as="h2">{vm.costLabels.functions}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {vm.cost.functionExecutions} calls · {vm.cost.functionGbSeconds.toFixed(1)} GB-s
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Transformations</CardDescription>
                  <CardTitle as="h2">{vm.costLabels.transformations}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {vm.cost.transformationHours.toFixed(2)} job-hours (2 DBU analog)
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle as="h2">Running now</CardTitle>
                <CardDescription>Elapsed time since start</CardDescription>
              </CardHeader>
              <CardContent>
                {vm.live.length === 0 ? (
                  <EmptyState variant="compact">
                    <EmptyStateTitle as="h3">No workflows running</EmptyStateTitle>
                    <EmptyStateDescription>
                      Nothing is in progress in this project right now.
                    </EmptyStateDescription>
                  </EmptyState>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {vm.live.map((execution) => (
                      <li key={execution.id}>
                        <Button
                          variant="ghost"
                          className="h-auto w-full justify-between py-3"
                          onClick={() => vm.selectExecution(execution.id)}
                        >
                          <span className="truncate text-left">{execution.workflowExternalId}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            {statusBadge(execution.status)}
                            <span>{execution.durationLabel}</span>
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle as="h2">Executions (24h + live)</CardTitle>
                </CardHeader>
                <CardContent>
                  {vm.recent.length === 0 ? (
                    <EmptyState variant="compact">
                      <EmptyStateTitle as="h3">No executions in this window</EmptyStateTitle>
                      <EmptyStateDescription>
                        Workflow runs from the last 24 hours will show up here.
                      </EmptyStateDescription>
                    </EmptyState>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {vm.recent.map((execution) => (
                        <li key={execution.id}>
                          <Button
                            variant={vm.selected?.id === execution.id ? 'secondary' : 'ghost'}
                            className="h-auto w-full justify-between py-3"
                            onClick={() => vm.selectExecution(execution.id)}
                          >
                            <span className="truncate text-left">
                              {execution.workflowExternalId}
                              <span className="block text-sm text-muted-foreground">
                                {execution.version ? `v${execution.version}` : execution.id}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              {statusBadge(execution.status)}
                              <span>{execution.durationLabel}</span>
                            </span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle as="h2">Workflow detail</CardTitle>
                  <CardDescription>Select an execution to inspect tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  {vm.selected === null ? (
                    <EmptyState variant="compact">
                      <EmptyStateTitle as="h3">No execution selected</EmptyStateTitle>
                      <EmptyStateDescription>
                        Choose a workflow run to see function and transformation tasks.
                      </EmptyStateDescription>
                    </EmptyState>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{vm.selected.workflowExternalId}</div>
                          <div className="text-sm text-muted-foreground">{vm.selected.id}</div>
                        </div>
                        {statusBadge(vm.selected.status)}
                      </div>
                      <div className="text-sm">Duration {vm.selected.durationLabel}</div>
                      <Separator />
                      {vm.selected.tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No task details returned for this execution.
                        </p>
                      ) : (
                        vm.selected.tasks.map((task) => <TaskRow key={task.id} task={task} />)
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle as="h2">Performance and save-cost recommendations</CardTitle>
              <CardDescription>Rule-based on this 24-hour window. Not billed savings.</CardDescription>
            </CardHeader>
            <CardContent>
              {vm.recommendations.length === 0 ? (
                <EmptyState variant="compact">
                  <EmptyStateTitle as="h3">No recommendations yet</EmptyStateTitle>
                  <EmptyStateDescription>
                    Repeated failures, long runs vs median, and skewed analog cost will appear here.
                  </EmptyStateDescription>
                </EmptyState>
              ) : (
                <ul className="flex flex-col gap-3">
                  {vm.recommendations.map((rec) => (
                    <li key={rec.id}>
                      <Alert variant={rec.severity === 'warning' ? 'warning' : 'info'}>
                        <AlertDescription>
                          <div className="font-medium">{rec.title}</div>
                          <div>{rec.detail}</div>
                        </AlertDescription>
                      </Alert>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
