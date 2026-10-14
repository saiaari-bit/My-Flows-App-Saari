import { vi } from 'vitest';

import type {
  AssetMatch,
  AssetSummary,
  ChartSeries,
  DocumentFile,
  InstanceRef,
  Signal,
  WorkOrder,
} from '../domain/asset360Types';
import type { Asset360Service, SignalsResult } from '../services/asset360Service';

export const FIXTURE_NOW = Date.parse('2026-03-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

export const PUMP_REF: InstanceRef = { space: 'test-instances', externalId: '23-HA-9114' };

export const pumpMatch: AssetMatch = {
  ref: PUMP_REF,
  label: 'Cooling water pump',
  name: 'Cooling water pump',
  description: 'Main cooling water circulation pump',
  aliases: ['21PT1019'],
};

export const pumpSummary: AssetSummary = {
  ref: PUMP_REF,
  label: 'Cooling water pump',
  name: 'Cooling water pump',
  description: 'Main cooling water circulation pump',
  tags: ['rotating', 'critical'],
  aliases: ['21PT1019'],
  sourceId: 'SAP-4711',
  parent: { space: 'test-instances', externalId: 'pump-station-1' },
  root: { space: 'test-instances', externalId: 'plant-1' },
};

export const pressureSignal: Signal = {
  ref: { space: 'test-instances', externalId: 'ts-pressure' },
  label: 'Discharge pressure',
  name: 'Discharge pressure',
  description: 'PT-1019',
  kind: 'numeric',
  isStep: false,
  unit: 'bar',
  latest: { timestamp: FIXTURE_NOW - 5 * 60 * 1000, value: 4.2 },
};

export const runStateSignal: Signal = {
  ref: { space: 'test-instances', externalId: 'ts-run-state' },
  label: 'Run state',
  name: 'Run state',
  kind: 'state',
  latest: { timestamp: FIXTURE_NOW - 60 * 1000, value: 'RUNNING' },
};

export const silentSignal: Signal = {
  ref: { space: 'test-instances', externalId: 'ts-vibration' },
  label: 'Bearing vibration',
  name: 'Bearing vibration',
  kind: 'numeric',
  unit: 'mm/s',
};

export const signalsResult: SignalsResult = {
  signals: [pressureSignal, runStateSignal, silentSignal],
  warnings: [],
};

export const pressureChartSeries: ChartSeries = {
  ref: pressureSignal.ref,
  label: pressureSignal.label,
  unit: 'bar',
  points: [
    { timestamp: FIXTURE_NOW - 2 * HOUR, value: 4.1 },
    { timestamp: FIXTURE_NOW - HOUR, value: 4.3 },
  ],
};

export const completedWorkOrder: WorkOrder = {
  ref: { space: 'test-instances', externalId: 'wo-1' },
  label: 'Replace mechanical seal',
  name: 'Replace mechanical seal',
  description: 'Seal replacement after leak report',
  status: 'completed',
  startTime: FIXTURE_NOW - 30 * 24 * HOUR,
  endTime: FIXTURE_NOW - 29 * 24 * HOUR,
  sourceId: 'WO-90210',
};

export const plannedWorkOrder: WorkOrder = {
  ref: { space: 'test-instances', externalId: 'wo-2' },
  label: 'Quarterly vibration survey',
  name: 'Quarterly vibration survey',
  status: 'planned',
  scheduledStartTime: FIXTURE_NOW + 7 * 24 * HOUR,
  scheduledEndTime: FIXTURE_NOW + 8 * 24 * HOUR,
};

export const uploadedDocument: DocumentFile = {
  ref: { space: 'test-instances', externalId: 'file-pid' },
  label: 'P&ID 23-HA-9114.pdf',
  name: 'P&ID 23-HA-9114.pdf',
  description: 'Piping and instrumentation diagram',
  mimeType: 'application/pdf',
  isUploaded: true,
  uploadedTime: FIXTURE_NOW - 90 * 24 * HOUR,
};

export const pendingDocument: DocumentFile = {
  ref: { space: 'test-instances', externalId: 'file-datasheet' },
  label: 'Datasheet.pdf',
  name: 'Datasheet.pdf',
  mimeType: 'application/pdf',
  isUploaded: false,
};

export type StubAsset360Service = {
  [K in keyof Asset360Service]: ReturnType<typeof vi.fn<Asset360Service[K]>>;
} & Asset360Service;

/** A service that resolves with the fixtures above. Override per test. */
export function stubAsset360Service(): StubAsset360Service {
  return {
    searchAssets: vi.fn(() => Promise.resolve([pumpMatch])),
    getAsset: vi.fn(() => Promise.resolve(pumpSummary)),
    getSignals: vi.fn(() => Promise.resolve(signalsResult)),
    getChartSeries: vi.fn(() => Promise.resolve([pressureChartSeries])),
    getWorkOrders: vi.fn(() => Promise.resolve([completedWorkOrder, plannedWorkOrder])),
    getDocuments: vi.fn(() => Promise.resolve([uploadedDocument, pendingDocument])),
    getDocumentDownloadUrl: vi.fn(() => Promise.resolve('https://files.example.test/file-pid')),
  };
}
