import { vi } from 'vitest';

import type {
  AssetTimeSeries,
  TimeSeriesService,
} from '@/services/timeSeriesService';

export function createTimeSeriesServiceStub() {
  return {
    getAssetTimeSeries: vi.fn<TimeSeriesService['getAssetTimeSeries']>(() =>
      Promise.resolve([])
    ),
    getLatestDatapoints: vi.fn<TimeSeriesService['getLatestDatapoints']>(() =>
      Promise.resolve([])
    ),
    getDatapoints: vi.fn<TimeSeriesService['getDatapoints']>(() =>
      Promise.resolve([])
    ),
  };
}

export type TimeSeriesServiceStub = ReturnType<typeof createTimeSeriesServiceStub>;

export function makeTimeSeries(
  externalId: string,
  overrides: Partial<AssetTimeSeries> = {}
): AssetTimeSeries {
  return { space: 'my-space', externalId, ...overrides };
}
