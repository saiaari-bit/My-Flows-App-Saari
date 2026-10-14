import { describe, expect, it } from 'vitest';

import { deriveWorkOrderStatus, workOrderStatusLabel } from './workOrderStatus';

const NOW = Date.parse('2026-03-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe(deriveWorkOrderStatus.name, () => {
  it('reports completed when the activity already ended', () => {
    expect(deriveWorkOrderStatus({ startTime: NOW - 3 * HOUR, endTime: NOW - HOUR }, NOW)).toBe('completed');
  });

  it('reports in progress when it started but has not ended', () => {
    expect(deriveWorkOrderStatus({ startTime: NOW - HOUR }, NOW)).toBe('inProgress');
  });

  it('reports in progress when the end time is still in the future', () => {
    expect(deriveWorkOrderStatus({ startTime: NOW - HOUR, endTime: NOW + HOUR }, NOW)).toBe('inProgress');
  });

  it('reports planned when only scheduled times are known', () => {
    expect(
      deriveWorkOrderStatus({ scheduledStartTime: NOW + HOUR, scheduledEndTime: NOW + 3 * HOUR }, NOW)
    ).toBe('planned');
  });

  it('reports planned when the actual start is still in the future', () => {
    expect(deriveWorkOrderStatus({ startTime: NOW + HOUR }, NOW)).toBe('planned');
  });

  it('reports planned when only a future end time is known', () => {
    expect(deriveWorkOrderStatus({ endTime: NOW + HOUR }, NOW)).toBe('planned');
  });

  it('reports unknown when the activity carries no times at all', () => {
    expect(deriveWorkOrderStatus({}, NOW)).toBe('unknown');
  });
});

describe(workOrderStatusLabel.name, () => {
  it('gives every status a readable label, so colour is never the only signal', () => {
    expect(workOrderStatusLabel('completed')).toBe('Completed');
    expect(workOrderStatusLabel('inProgress')).toBe('In progress');
    expect(workOrderStatusLabel('planned')).toBe('Planned');
    expect(workOrderStatusLabel('unknown')).toBe('Unknown');
  });
});
