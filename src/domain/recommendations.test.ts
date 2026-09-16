import { describe, expect, it } from 'vitest';

import type { WorkflowExecutionRecord } from './operationsTypes';
import { buildRecommendations } from './recommendations';

function execution(
  partial: Partial<WorkflowExecutionRecord> & Pick<WorkflowExecutionRecord, 'id' | 'status'>,
): WorkflowExecutionRecord {
  return {
    workflowExternalId: 'wf-a',
    version: '1',
    createdMs: 1,
    startMs: 1,
    endMs: 1000,
    tasks: [],
    ...partial,
  };
}

describe('buildRecommendations', () => {
  it('flags repeated failures for the same workflow', () => {
    const recs = buildRecommendations({
      executions: [
        execution({ id: '1', status: 'FAILED' }),
        execution({ id: '2', status: 'FAILED' }),
      ],
      functionCalls: [],
      transformationJobs: [],
      nowMs: 5000,
    });
    expect(recs.some((rec) => rec.id === 'repeat-fail:wf-a')).toBe(true);
  });

  it('flags a run at least twice the median duration', () => {
    const recs = buildRecommendations({
      executions: [
        execution({ id: 'a', status: 'COMPLETED', startMs: 0, endMs: 1000 }),
        execution({ id: 'b', status: 'COMPLETED', startMs: 0, endMs: 1000 }),
        execution({ id: 'c', status: 'COMPLETED', startMs: 0, endMs: 4000 }),
      ],
      functionCalls: [],
      transformationJobs: [],
      nowMs: 10_000,
    });
    expect(recs.some((rec) => rec.id === 'long-run:c')).toBe(true);
  });
});
