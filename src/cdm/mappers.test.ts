import { describe, expect, it } from 'vitest';

import { bareNode, cdmNode, TEST_SPACE } from '../__mocks__/cdmNodes';

import {
  signalUnitRelation,
  toAssetMatch,
  toAssetSummary,
  toDocumentFile,
  toSignal,
  toUnitLabel,
  toWorkOrder,
} from './mappers';
import { ACTIVITY_VIEW, ASSET_VIEW, FILE_VIEW, TIME_SERIES_VIEW, UNIT_VIEW } from './views';

const NOW = Date.parse('2026-03-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe(toAssetMatch.name, () => {
  it('maps the searchable asset properties', () => {
    const node = cdmNode(ASSET_VIEW, '23-HA-9114', {
      name: 'Water pump',
      description: 'Cooling water pump',
      aliases: ['21PT1019'],
    });

    expect(toAssetMatch(node)).toEqual({
      ref: { space: TEST_SPACE, externalId: '23-HA-9114' },
      label: 'Water pump',
      name: 'Water pump',
      description: 'Cooling water pump',
      aliases: ['21PT1019'],
    });
  });

  it('falls back to the external id so a result row is never blank', () => {
    expect(toAssetMatch(bareNode('23-HA-9114')).label).toBe('23-HA-9114');
  });
});

describe(toAssetSummary.name, () => {
  it('maps describable, sourceable, and hierarchy properties', () => {
    const node = cdmNode(ASSET_VIEW, 'asset-1', {
      name: 'Water pump',
      description: 'Cooling water pump',
      tags: ['rotating', 'critical'],
      aliases: ['21PT1019'],
      sourceId: 'SAP-4711',
      parent: { space: TEST_SPACE, externalId: 'station-1' },
      root: { space: TEST_SPACE, externalId: 'plant-1' },
    });

    expect(toAssetSummary(node)).toEqual({
      ref: { space: TEST_SPACE, externalId: 'asset-1' },
      label: 'Water pump',
      name: 'Water pump',
      description: 'Cooling water pump',
      tags: ['rotating', 'critical'],
      aliases: ['21PT1019'],
      sourceId: 'SAP-4711',
      parent: { space: TEST_SPACE, externalId: 'station-1' },
      root: { space: TEST_SPACE, externalId: 'plant-1' },
    });
  });

  it('leaves absent properties undefined instead of inventing values', () => {
    const summary = toAssetSummary(cdmNode(ASSET_VIEW, 'asset-1', { name: 'Pump' }));
    expect(summary.description).toBeUndefined();
    expect(summary.sourceId).toBeUndefined();
    expect(summary.parent).toBeUndefined();
    expect(summary.tags).toEqual([]);
  });
});

describe(toSignal.name, () => {
  it('maps the time series properties and uses sourceUnit as the unit', () => {
    const node = cdmNode(TIME_SERIES_VIEW, 'ts-1', {
      name: 'Discharge pressure',
      description: 'PT-1019',
      type: 'numeric',
      isStep: false,
      sourceUnit: 'bar',
    });

    expect(toSignal(node)).toEqual({
      ref: { space: TEST_SPACE, externalId: 'ts-1' },
      label: 'Discharge pressure',
      name: 'Discharge pressure',
      description: 'PT-1019',
      kind: 'numeric',
      isStep: false,
      unit: 'bar',
    });
  });

  it('keeps the documented type enum and maps anything else to unknown', () => {
    expect(toSignal(cdmNode(TIME_SERIES_VIEW, 'ts', { type: 'string' })).kind).toBe('string');
    expect(toSignal(cdmNode(TIME_SERIES_VIEW, 'ts', { type: 'state' })).kind).toBe('state');
    expect(toSignal(cdmNode(TIME_SERIES_VIEW, 'ts', { type: 'float64' })).kind).toBe('unknown');
    expect(toSignal(cdmNode(TIME_SERIES_VIEW, 'ts', {})).kind).toBe('unknown');
  });

  it('leaves the unit undefined when only the unit relation is set', () => {
    const node = cdmNode(TIME_SERIES_VIEW, 'ts-1', {
      type: 'numeric',
      unit: { space: 'cdf_cdm_units', externalId: 'pressure:bar' },
    });
    expect(toSignal(node).unit).toBeUndefined();
    expect(signalUnitRelation(node)).toEqual({ space: 'cdf_cdm_units', externalId: 'pressure:bar' });
  });
});

describe(toUnitLabel.name, () => {
  it('prefers the unit symbol over its name', () => {
    expect(toUnitLabel(cdmNode(UNIT_VIEW, 'u', { symbol: 'bar', name: 'Bar' }))).toBe('bar');
    expect(toUnitLabel(cdmNode(UNIT_VIEW, 'u', { name: 'Bar' }))).toBe('Bar');
    expect(toUnitLabel(cdmNode(UNIT_VIEW, 'u', {}))).toBeUndefined();
  });
});

describe(toWorkOrder.name, () => {
  it('maps schedule properties and derives the status', () => {
    const node = cdmNode(ACTIVITY_VIEW, 'wo-1', {
      name: 'Replace seal',
      description: 'Mechanical seal replacement',
      startTime: NOW - 3 * HOUR,
      endTime: NOW - HOUR,
      scheduledStartTime: NOW - 4 * HOUR,
      scheduledEndTime: NOW - 2 * HOUR,
      sourceId: 'WO-90210',
    });

    expect(toWorkOrder(node, NOW)).toEqual({
      ref: { space: TEST_SPACE, externalId: 'wo-1' },
      label: 'Replace seal',
      name: 'Replace seal',
      description: 'Mechanical seal replacement',
      status: 'completed',
      startTime: NOW - 3 * HOUR,
      endTime: NOW - HOUR,
      scheduledStartTime: NOW - 4 * HOUR,
      scheduledEndTime: NOW - 2 * HOUR,
      sourceId: 'WO-90210',
    });
  });

  it('reports unknown status for an activity with no times', () => {
    expect(toWorkOrder(cdmNode(ACTIVITY_VIEW, 'wo-2', { name: 'Inspect' }), NOW).status).toBe('unknown');
  });
});

describe(toDocumentFile.name, () => {
  it('maps the file properties', () => {
    const node = cdmNode(FILE_VIEW, 'file-1', {
      name: 'P&ID 23-HA.pdf',
      description: 'Piping and instrumentation diagram',
      mimeType: 'application/pdf',
      directory: '/plant/pid',
      isUploaded: true,
      uploadedTime: NOW - HOUR,
    });

    expect(toDocumentFile(node)).toEqual({
      ref: { space: TEST_SPACE, externalId: 'file-1' },
      label: 'P&ID 23-HA.pdf',
      name: 'P&ID 23-HA.pdf',
      description: 'Piping and instrumentation diagram',
      mimeType: 'application/pdf',
      directory: '/plant/pid',
      isUploaded: true,
      uploadedTime: NOW - HOUR,
    });
  });

  it('treats anything other than true as not uploaded, since only true means content exists', () => {
    expect(toDocumentFile(cdmNode(FILE_VIEW, 'f', { isUploaded: false })).isUploaded).toBe(false);
    expect(toDocumentFile(cdmNode(FILE_VIEW, 'f', {})).isUploaded).toBe(false);
  });
});
