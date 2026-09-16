import { describe, expect, it } from 'vitest';

import {
  AZURE_FUNCTIONS_GB_SECOND_USD,
  AZURE_FUNCTIONS_PER_MILLION_EXECUTIONS_USD,
} from '../config/azureAnalogRates';

import { estimateFunctionCostUsd, estimateTransformationCostUsd, sumAnalogCost } from './costEstimate';
import type { FunctionCallRecord, TransformationJobRecord } from './operationsTypes';

describe('estimateFunctionCostUsd', () => {
  it('charges GB-seconds plus per-million executions', () => {
    const usd = estimateFunctionCostUsd({
      memoryGb: 2,
      durationMs: 10_000,
      executions: 1_000_000,
    });
    expect(usd).toBeCloseTo(2 * 10 * AZURE_FUNCTIONS_GB_SECOND_USD + AZURE_FUNCTIONS_PER_MILLION_EXECUTIONS_USD);
  });
});

describe('estimateTransformationCostUsd', () => {
  it('uses 2 DBU at $0.30 per DBU-hour', () => {
    const oneHourMs = 3_600_000;
    expect(estimateTransformationCostUsd(oneHourMs)).toBeCloseTo(0.6);
  });
});

describe('sumAnalogCost', () => {
  it('splits functions and transformations and sums total', () => {
    const functionCalls: FunctionCallRecord[] = [
      {
        id: 'c1',
        functionId: 1,
        functionExternalId: 'fn',
        status: 'COMPLETED',
        startMs: 0,
        endMs: 1000,
        memoryGb: 2,
      },
    ];
    const transformationJobs: TransformationJobRecord[] = [
      {
        id: 9,
        transformationId: 2,
        transformationExternalId: 'tr',
        status: 'COMPLETED',
        startMs: 0,
        endMs: 3_600_000,
      },
    ];
    const cost = sumAnalogCost({ functionCalls, transformationJobs, nowMs: 10_000_000 });
    expect(cost.transformationsUsd).toBeCloseTo(0.6);
    expect(cost.functionsUsd).toBeGreaterThan(0);
    expect(cost.totalUsd).toBeCloseTo(cost.functionsUsd + cost.transformationsUsd);
  });
});
