import { COST_DISCLAIMER } from '../config/azureAnalogRates';
import { useOperationsStorage } from '../context/operationsStorageContext';
import { useOperationsDeps } from '../context/OperationsViewModelContext';
import { executionDurationMs, liveExecutions } from '../domain/aggregateOperations';
import { formatDuration, formatUsd, sumAnalogCost } from '../domain/costEstimate';
import type { Recommendation, WorkflowExecutionRecord } from '../domain/operationsTypes';
import { buildRecommendations } from '../domain/recommendations';

export type OperationsViewModel = {
  project: string;
  isLoading: boolean;
  sourceErrors: string[];
  disclaimer: string;
  live: Array<WorkflowExecutionRecord & { durationLabel: string }>;
  recent: Array<WorkflowExecutionRecord & { durationLabel: string }>;
  cost: ReturnType<typeof sumAnalogCost>;
  costLabels: { total: string; functions: string; transformations: string };
  recommendations: Recommendation[];
  selected: (WorkflowExecutionRecord & { durationLabel: string }) | null;
  tab: 'overview' | 'recommendations';
  selectExecution: (id: string | null) => void;
  setTab: (tab: 'overview' | 'recommendations') => void;
  reload: () => void;
};

export function useOperationsViewModel(): OperationsViewModel {
  const storage = useOperationsStorage();
  const { nowMs } = useOperationsDeps();
  const now = nowMs();
  const { snapshot } = storage;

  const withDuration = (execution: WorkflowExecutionRecord) => ({
    ...execution,
    durationLabel: formatDuration(executionDurationMs(execution, now)),
  });

  const live = liveExecutions(snapshot.executions).map(withDuration);
  const recent = snapshot.executions.map(withDuration);
  const cost = sumAnalogCost({
    functionCalls: snapshot.functionCalls,
    transformationJobs: snapshot.transformationJobs,
    nowMs: now,
  });
  const selectedRecord = snapshot.executions.find(
    (execution) => execution.id === storage.ui.selectedExecutionId,
  );

  return {
    project: storage.project,
    isLoading: storage.isLoading,
    sourceErrors: snapshot.sourceErrors,
    disclaimer: COST_DISCLAIMER,
    live,
    recent,
    cost,
    costLabels: {
      total: formatUsd(cost.totalUsd),
      functions: formatUsd(cost.functionsUsd),
      transformations: formatUsd(cost.transformationsUsd),
    },
    recommendations: buildRecommendations({
      executions: snapshot.executions,
      functionCalls: snapshot.functionCalls,
      transformationJobs: snapshot.transformationJobs,
      nowMs: now,
    }),
    selected: selectedRecord ? withDuration(selectedRecord) : null,
    tab: storage.ui.tab,
    selectExecution: storage.selectExecution,
    setTab: storage.setTab,
    reload: storage.reload,
  };
}
