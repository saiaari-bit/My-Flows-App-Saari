import { durationMs, estimateFunctionCostUsd, sumAnalogCost } from './costEstimate';
import type {
  FunctionCallRecord,
  Recommendation,
  TransformationJobRecord,
  WorkflowExecutionRecord,
} from './operationsTypes';

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const even = sorted.length % 2 === 0;
  if (even) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function buildRecommendations(params: {
  executions: WorkflowExecutionRecord[];
  functionCalls: FunctionCallRecord[];
  transformationJobs: TransformationJobRecord[];
  nowMs: number;
}): Recommendation[] {
  const recs: Recommendation[] = [];
  const failedByWorkflow = new Map<string, number>();
  const completedDurations = new Map<string, number[]>();

  for (const execution of params.executions) {
    if (execution.status === 'FAILED' || execution.status === 'TIMED_OUT') {
      failedByWorkflow.set(
        execution.workflowExternalId,
        (failedByWorkflow.get(execution.workflowExternalId) ?? 0) + 1,
      );
    }
    if (execution.status === 'COMPLETED') {
      const ms = durationMs(execution.startMs ?? execution.createdMs, execution.endMs, params.nowMs);
      const list = completedDurations.get(execution.workflowExternalId) ?? [];
      list.push(ms);
      completedDurations.set(execution.workflowExternalId, list);
    }
  }

  for (const [workflowExternalId, count] of failedByWorkflow) {
    if (count >= 2) {
      recs.push({
        id: `repeat-fail:${workflowExternalId}`,
        severity: 'warning',
        title: `Repeated failures: ${workflowExternalId}`,
        detail: `${count} failed or timed-out executions in the last 24 hours. Investigate the schedule or last error before it keeps consuming retries.`,
      });
    }
  }

  for (const execution of params.executions) {
    if (execution.status !== 'COMPLETED' && execution.status !== 'RUNNING') {
      continue;
    }
    const samples = completedDurations.get(execution.workflowExternalId) ?? [];
    const mid = median(samples);
    if (mid === null || mid === 0 || samples.length < 2) {
      continue;
    }
    const ms = durationMs(execution.startMs ?? execution.createdMs, execution.endMs, params.nowMs);
    if (ms >= mid * 2) {
      recs.push({
        id: `long-run:${execution.id}`,
        severity: 'info',
        title: `Long run vs typical: ${execution.workflowExternalId}`,
        detail: `This execution ran about ${(ms / mid).toFixed(1)}× the median duration for that workflow. Check slow function or transformation tasks.`,
      });
    }
  }

  const cost = sumAnalogCost({
    functionCalls: params.functionCalls,
    transformationJobs: params.transformationJobs,
    nowMs: params.nowMs,
  });
  if (cost.totalUsd > 0 && cost.functionsUsd / cost.totalUsd >= 0.7) {
    recs.push({
      id: 'functions-dominant',
      severity: 'info',
      title: 'Functions dominate analog cost',
      detail:
        'More than 70% of the 24-hour analog estimate comes from Cognite Functions. Review schedules and failed retries first.',
    });
  }
  if (cost.totalUsd > 0 && cost.transformationsUsd / cost.totalUsd >= 0.7) {
    recs.push({
      id: 'transformations-dominant',
      severity: 'info',
      title: 'Transformations dominate analog cost',
      detail:
        'More than 70% of the 24-hour analog estimate comes from Transformations. Look for full refreshes that could be incremental.',
    });
  }

  const failedCalls = params.functionCalls.filter(
    (call) => call.status === 'FAILED' || call.status === 'TIMED_OUT',
  );
  if (failedCalls.length >= 3) {
    const wasteUsd = failedCalls.reduce((sum, call) => {
      const ms = durationMs(call.startMs, call.endMs, params.nowMs);
      return (
        sum +
        estimateFunctionCostUsd({
          memoryGb: call.memoryGb,
          durationMs: ms,
          executions: 1,
        })
      );
    }, 0);
    recs.push({
      id: 'failed-function-waste',
      severity: 'warning',
      title: 'Failed function calls still accrue analog compute',
      detail: `${failedCalls.length} failed/timed-out function calls in the window (about ${wasteUsd.toFixed(4)} analog USD). Fix the error or pause the schedule.`,
    });
  }

  return recs;
}
