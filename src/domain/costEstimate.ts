import {
  AZURE_FUNCTIONS_GB_SECOND_USD,
  AZURE_FUNCTIONS_PER_MILLION_EXECUTIONS_USD,
  DATABRICKS_JOBS_DBU_PER_HOUR,
  DATABRICKS_JOBS_USD_PER_DBU_HOUR,
} from '../config/azureAnalogRates';

import type { AnalogCost, FunctionCallRecord, TransformationJobRecord } from './operationsTypes';

export function durationMs(startMs: number | null, endMs: number | null, nowMs: number): number {
  if (startMs === null) {
    return 0;
  }
  const end = endMs === null ? nowMs : endMs;
  return Math.max(0, end - startMs);
}

export function estimateFunctionCostUsd(params: {
  memoryGb: number;
  durationMs: number;
  executions: number;
}): number {
  const gbSeconds = params.memoryGb * (params.durationMs / 1000);
  return (
    gbSeconds * AZURE_FUNCTIONS_GB_SECOND_USD +
    (params.executions / 1_000_000) * AZURE_FUNCTIONS_PER_MILLION_EXECUTIONS_USD
  );
}

export function estimateTransformationCostUsd(durationMsValue: number): number {
  const hours = durationMsValue / 3_600_000;
  return hours * DATABRICKS_JOBS_DBU_PER_HOUR * DATABRICKS_JOBS_USD_PER_DBU_HOUR;
}

export function sumAnalogCost(params: {
  functionCalls: FunctionCallRecord[];
  transformationJobs: TransformationJobRecord[];
  nowMs: number;
}): AnalogCost {
  let functionGbSeconds = 0;
  for (const call of params.functionCalls) {
    const ms = durationMs(call.startMs, call.endMs, params.nowMs);
    functionGbSeconds += call.memoryGb * (ms / 1000);
  }

  const functionsUsd =
    functionGbSeconds * AZURE_FUNCTIONS_GB_SECOND_USD +
    (params.functionCalls.length / 1_000_000) * AZURE_FUNCTIONS_PER_MILLION_EXECUTIONS_USD;

  let transformationHours = 0;
  let transformationsUsd = 0;
  for (const job of params.transformationJobs) {
    const ms = durationMs(job.startMs, job.endMs, params.nowMs);
    transformationHours += ms / 3_600_000;
    transformationsUsd += estimateTransformationCostUsd(ms);
  }

  return {
    functionsUsd,
    transformationsUsd,
    totalUsd: functionsUsd + transformationsUsd,
    functionExecutions: params.functionCalls.length,
    functionGbSeconds,
    transformationHours,
  };
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return '$0.00';
  }
  if (value > 0 && value < 0.01) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
