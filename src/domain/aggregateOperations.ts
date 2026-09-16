import { OPS_WINDOW_MS } from '../config/azureAnalogRates';

import { durationMs } from './costEstimate';
import type { OperationsSnapshot, WorkflowExecutionRecord } from './operationsTypes';

export function isLiveStatus(status: WorkflowExecutionRecord['status']): boolean {
  return status === 'RUNNING';
}

export function liveExecutions(
  executions: WorkflowExecutionRecord[],
): WorkflowExecutionRecord[] {
  return executions.filter((execution) => isLiveStatus(execution.status));
}

export function inWindow(
  executions: WorkflowExecutionRecord[],
  windowStartMs: number,
): WorkflowExecutionRecord[] {
  return executions.filter((execution) => execution.createdMs >= windowStartMs);
}

export function executionDurationMs(execution: WorkflowExecutionRecord, nowMs: number): number {
  return durationMs(execution.startMs ?? execution.createdMs, execution.endMs, nowMs);
}

export function snapshotWindowStart(nowMs: number): number {
  return nowMs - OPS_WINDOW_MS;
}

export function emptySnapshot(nowMs: number): OperationsSnapshot {
  return {
    fetchedAtMs: nowMs,
    windowStartMs: snapshotWindowStart(nowMs),
    executions: [],
    functionCalls: [],
    transformationJobs: [],
    sourceErrors: [],
  };
}
