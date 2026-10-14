import type { WorkOrderStatus } from './asset360Types';

type ScheduleFields = {
  startTime?: number;
  endTime?: number;
  scheduledStartTime?: number;
  scheduledEndTime?: number;
};

/**
 * Derives a work-order status from `CogniteSchedulable` fields.
 *
 * `CogniteActivity` carries no status property in the core data model, so the
 * schedule is the only evidence available:
 *
 * - an actual end time in the past  -> completed
 * - an actual start time, no end    -> in progress
 * - only planned times              -> planned
 * - nothing usable                  -> unknown
 */
export function deriveWorkOrderStatus(activity: ScheduleFields, now: number): WorkOrderStatus {
  const { startTime, endTime, scheduledStartTime, scheduledEndTime } = activity;

  if (endTime !== undefined && endTime <= now) {
    return 'completed';
  }
  if (startTime !== undefined && startTime <= now) {
    return 'inProgress';
  }
  if (startTime !== undefined || scheduledStartTime !== undefined || scheduledEndTime !== undefined) {
    return 'planned';
  }
  return endTime !== undefined ? 'planned' : 'unknown';
}

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  completed: 'Completed',
  inProgress: 'In progress',
  planned: 'Planned',
  unknown: 'Unknown',
};

export function workOrderStatusLabel(status: WorkOrderStatus): string {
  return STATUS_LABELS[status];
}
