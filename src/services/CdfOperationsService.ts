import { CDF_AZURE_FUNCTION_DEFAULT_MEMORY_GB } from '../config/azureAnalogRates';
import { emptySnapshot, snapshotWindowStart } from '../domain/aggregateOperations';
import type {
  ExecutionStatus,
  FunctionCallRecord,
  OperationsSnapshot,
  TaskKind,
  TransformationJobRecord,
  WorkflowExecutionRecord,
  WorkflowTask,
} from '../domain/operationsTypes';

import type { CdfHttp, OperationsService } from './operationsService';

const MAX_FUNCTIONS = 25;
const MAX_TRANSFORMATIONS = 25;
const MAX_EXECUTION_DETAILS = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

function itemsFrom(data: unknown): unknown[] {
  if (!isRecord(data)) {
    return [];
  }
  const items = data.items;
  return Array.isArray(items) ? items : [];
}

function toStatus(value: unknown): ExecutionStatus {
  const raw = asString(value, 'UNKNOWN').toUpperCase();
  if (
    raw === 'RUNNING' ||
    raw === 'COMPLETED' ||
    raw === 'FAILED' ||
    raw === 'TIMED_OUT' ||
    raw === 'CANCELED' ||
    raw === 'TERMINATED'
  ) {
    return raw;
  }
  if (raw === 'TIMEOUT') {
    return 'TIMED_OUT';
  }
  if (raw === 'CANCELLED') {
    return 'CANCELED';
  }
  return 'UNKNOWN';
}

function toKind(value: unknown): TaskKind {
  const raw = asString(value, '').toLowerCase();
  if (raw === 'function') {
    return 'function';
  }
  if (raw === 'transformation') {
    return 'transformation';
  }
  return 'other';
}

function timeMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (isRecord(value)) {
    return asNumber(value.min ?? value.ms ?? value.value, null);
  }
  return null;
}

class CdfOperationsService implements OperationsService {
  constructor(private readonly http: CdfHttp) {}

  async loadWindow(nowMs: number): Promise<OperationsSnapshot> {
    const snapshot = emptySnapshot(nowMs);
    const windowStart = snapshotWindowStart(nowMs);
    snapshot.windowStartMs = windowStart;
    snapshot.fetchedAtMs = nowMs;

    const [running, recent, functionCalls, transformationJobs] = await Promise.all([
      this.loadExecutions({ status: 'RUNNING' }, snapshot.sourceErrors),
      this.loadExecutions({ createdTime: { min: windowStart, max: nowMs } }, snapshot.sourceErrors),
      this.loadFunctionCalls(windowStart, snapshot.sourceErrors),
      this.loadTransformationJobs(windowStart, snapshot.sourceErrors),
    ]);

    const byId = new Map<string, WorkflowExecutionRecord>();
    for (const execution of [...running, ...recent]) {
      byId.set(execution.id, execution);
    }

    const merged = [...byId.values()];
    const detailed = await this.attachDetails(merged, snapshot.sourceErrors);
    snapshot.executions = detailed;
    snapshot.functionCalls = functionCalls;
    snapshot.transformationJobs = transformationJobs;
    return snapshot;
  }

  private async loadExecutions(
    filter: Record<string, unknown>,
    errors: string[],
  ): Promise<WorkflowExecutionRecord[]> {
    try {
      const path = `/api/v1/projects/${this.http.project}/workflows/executions/list`;
      const response = await this.http.post<unknown>(path, {
        data: { filter, limit: 100 },
      });
      return itemsFrom(response.data).map((item) => this.parseExecution(item)).filter(isExecution);
    } catch (error) {
      errors.push(`Workflows: ${messageFromUnknown(error)}`);
      return [];
    }
  }

  private parseExecution(item: unknown): WorkflowExecutionRecord | null {
    if (!isRecord(item)) {
      return null;
    }
    const id = asString(item.id);
    const workflowExternalId = asString(item.workflowExternalId);
    if (!id || !workflowExternalId) {
      return null;
    }
    return {
      id,
      workflowExternalId,
      version: asString(item.version, ''),
      status: toStatus(item.status),
      createdMs: asNumber(item.createdTime, 0) ?? 0,
      startMs: timeMs(item.startTime),
      endMs: timeMs(item.endTime),
      tasks: [],
    };
  }

  private async attachDetails(
    executions: WorkflowExecutionRecord[],
    errors: string[],
  ): Promise<WorkflowExecutionRecord[]> {
    const slice = executions.slice(0, MAX_EXECUTION_DETAILS);
    const rest = executions.slice(MAX_EXECUTION_DETAILS);
    const detailed = await Promise.all(
      slice.map(async (execution) => {
        try {
          const path = `/api/v1/projects/${this.http.project}/workflows/executions/${encodeURIComponent(execution.id)}`;
          const response = await this.http.get<unknown>(path);
          const tasks = parseTasks(response.data);
          return { ...execution, tasks };
        } catch (error) {
          errors.push(`Workflow ${execution.id}: ${messageFromUnknown(error)}`);
          return execution;
        }
      }),
    );
    return [...detailed, ...rest];
  }

  private async loadFunctionCalls(windowStartMs: number, errors: string[]): Promise<FunctionCallRecord[]> {
    let functions: unknown[] = [];
    try {
      const path = `/api/v1/projects/${this.http.project}/functions`;
      const response = await this.http.get<unknown>(path, { params: { limit: MAX_FUNCTIONS } });
      functions = itemsFrom(response.data);
    } catch (error) {
      errors.push(`Functions list: ${messageFromUnknown(error)}`);
      return [];
    }

    const calls: FunctionCallRecord[] = [];
    for (const fn of functions.slice(0, MAX_FUNCTIONS)) {
      if (!isRecord(fn)) {
        continue;
      }
      const functionId = asNumber(fn.id, null);
      if (functionId === null) {
        continue;
      }
      const memoryGb = asNumber(fn.memory, CDF_AZURE_FUNCTION_DEFAULT_MEMORY_GB) ?? CDF_AZURE_FUNCTION_DEFAULT_MEMORY_GB;
      const externalId = asString(fn.externalId, String(functionId));
      try {
        const path = `/api/v1/projects/${this.http.project}/functions/${functionId}/calls`;
        const response = await this.http.get<unknown>(path, { params: { limit: 100 } });
        for (const item of itemsFrom(response.data)) {
          const parsed = parseFunctionCall(item, functionId, externalId, memoryGb, windowStartMs);
          if (parsed) {
            calls.push(parsed);
          }
        }
      } catch (error) {
        errors.push(`Function calls ${externalId}: ${messageFromUnknown(error)}`);
      }
    }
    return calls;
  }

  private async loadTransformationJobs(
    windowStartMs: number,
    errors: string[],
  ): Promise<TransformationJobRecord[]> {
    let transformations: unknown[] = [];
    try {
      const path = `/api/v1/projects/${this.http.project}/transformations`;
      const response = await this.http.get<unknown>(path, { params: { limit: MAX_TRANSFORMATIONS } });
      transformations = itemsFrom(response.data);
    } catch (error) {
      errors.push(`Transformations list: ${messageFromUnknown(error)}`);
      return [];
    }

    const jobs: TransformationJobRecord[] = [];
    for (const tr of transformations.slice(0, MAX_TRANSFORMATIONS)) {
      if (!isRecord(tr)) {
        continue;
      }
      const transformationId = asNumber(tr.id, null);
      if (transformationId === null) {
        continue;
      }
      const externalId = asString(tr.externalId, String(transformationId));
      try {
        const path = `/api/v1/projects/${this.http.project}/transformations/jobs`;
        const response = await this.http.get<unknown>(path, {
          params: { transformationId, limit: 50 },
        });
        for (const item of itemsFrom(response.data)) {
          const parsed = parseTransformationJob(item, transformationId, externalId, windowStartMs);
          if (parsed) {
            jobs.push(parsed);
          }
        }
      } catch (error) {
        errors.push(`Transformation jobs ${externalId}: ${messageFromUnknown(error)}`);
      }
    }
    return jobs;
  }
}

function isExecution(value: WorkflowExecutionRecord | null): value is WorkflowExecutionRecord {
  return value !== null;
}

function parseTasks(data: unknown): WorkflowTask[] {
  if (!isRecord(data)) {
    return [];
  }
  const executed = data.executedTasks;
  const list = Array.isArray(executed) ? executed : [];
  const tasks: WorkflowTask[] = [];
  for (const item of list) {
    if (!isRecord(item)) {
      continue;
    }
    const id = asString(item.id, asString(item.externalId));
    if (!id) {
      continue;
    }
    tasks.push({
      id,
      externalId: asString(item.externalId, id),
      kind: toKind(item.taskType ?? item.type),
      status: toStatus(item.status),
      startMs: timeMs(item.startTime),
      endMs: timeMs(item.endTime),
    });
  }
  return tasks;
}

function parseFunctionCall(
  item: unknown,
  functionId: number,
  functionExternalId: string,
  memoryGb: number,
  windowStartMs: number,
): FunctionCallRecord | null {
  if (!isRecord(item)) {
    return null;
  }
  const id = asString(item.id, String(asNumber(item.id, 0) ?? 0));
  const startMs = timeMs(item.startTime);
  if (startMs !== null && startMs < windowStartMs) {
    return null;
  }
  return {
    id,
    functionId,
    functionExternalId,
    status: toStatus(item.status),
    startMs,
    endMs: timeMs(item.endTime),
    memoryGb,
  };
}

function parseTransformationJob(
  item: unknown,
  transformationId: number,
  transformationExternalId: string,
  windowStartMs: number,
): TransformationJobRecord | null {
  if (!isRecord(item)) {
    return null;
  }
  const id = asNumber(item.id, null);
  if (id === null) {
    return null;
  }
  const startMs = timeMs(item.createdTime ?? item.startTime);
  if (startMs !== null && startMs < windowStartMs) {
    return null;
  }
  return {
    id,
    transformationId,
    transformationExternalId,
    status: toStatus(item.status),
    startMs,
    endMs: timeMs(item.finishedTime ?? item.endTime),
  };
}

export function createCdfOperationsService(http: CdfHttp): OperationsService {
  return new CdfOperationsService(http);
}
