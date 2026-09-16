export type ExecutionStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'CANCELED'
  | 'TERMINATED'
  | 'UNKNOWN';

export type TaskKind = 'function' | 'transformation' | 'other';

export type WorkflowTask = {
  id: string;
  externalId: string;
  kind: TaskKind;
  status: ExecutionStatus;
  startMs: number | null;
  endMs: number | null;
};

export type WorkflowExecutionRecord = {
  id: string;
  workflowExternalId: string;
  version: string;
  status: ExecutionStatus;
  createdMs: number;
  startMs: number | null;
  endMs: number | null;
  tasks: WorkflowTask[];
};

export type FunctionCallRecord = {
  id: string;
  functionId: number;
  functionExternalId: string;
  status: ExecutionStatus;
  startMs: number | null;
  endMs: number | null;
  memoryGb: number;
};

export type TransformationJobRecord = {
  id: number;
  transformationId: number;
  transformationExternalId: string;
  status: ExecutionStatus;
  startMs: number | null;
  endMs: number | null;
};

export type OperationsSnapshot = {
  fetchedAtMs: number;
  windowStartMs: number;
  executions: WorkflowExecutionRecord[];
  functionCalls: FunctionCallRecord[];
  transformationJobs: TransformationJobRecord[];
  sourceErrors: string[];
};

export type AnalogCost = {
  functionsUsd: number;
  transformationsUsd: number;
  totalUsd: number;
  functionExecutions: number;
  functionGbSeconds: number;
  transformationHours: number;
};

export type Recommendation = {
  id: string;
  severity: 'warning' | 'info';
  title: string;
  detail: string;
};
