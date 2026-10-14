import type { CdmInstance, InstanceId, InstanceListClient } from './cdm';
import {
  INSTANCE_LIST_PAGE_SIZE,
  cdmView,
  linkedToAssetFilter,
  listAllInstances,
  readString,
  readTimestamp,
} from './cdm';

export const ACTIVITY_VIEW_EXTERNAL_ID = 'CogniteActivity';

/**
 * The work-order fields the activities panel needs (FR-011 / AS-11).
 *
 * `CogniteActivity` carries no status of its own; planned versus in-progress
 * versus finished has to be derived from these Schedulable timestamps.
 * Timestamps are epoch milliseconds.
 */
export type AssetActivity = {
  space: string;
  externalId: string;
  name?: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  scheduledStartTime?: number;
  scheduledEndTime?: number;
};

export interface ActivityService {
  getAssetActivities(assetId: InstanceId): Promise<AssetActivity[]>;
}

export type ActivityServiceClient = InstanceListClient;

export class CdmActivityService implements ActivityService {
  constructor(private readonly client: ActivityServiceClient) {}

  /*
   * `CogniteAsset.activities` is a reverse direct relation list — the exact
   * case the Cognite documentation uses to explain why `/query` cannot walk
   * inwards. The relationship is owned by `CogniteActivity.assets`, so the read
   * starts from the activity view and filters on that list.
   *
   * No further filtering is applied: SPEC.md CL-007 leaves "what counts as a
   * work order" open and defaults to listing every linked activity.
   */
  async getAssetActivities(assetId: InstanceId): Promise<AssetActivity[]> {
    const instances = await listAllInstances(
      this.client,
      {
        instanceType: 'node',
        sources: [{ source: cdmView(ACTIVITY_VIEW_EXTERNAL_ID) }],
        filter: linkedToAssetFilter(ACTIVITY_VIEW_EXTERNAL_ID, assetId),
        limit: INSTANCE_LIST_PAGE_SIZE,
      },
      ACTIVITY_VIEW_EXTERNAL_ID
    );

    return instances.map(toAssetActivity);
  }
}

function toAssetActivity(instance: CdmInstance): AssetActivity {
  const { properties } = instance;

  return {
    space: instance.id.space,
    externalId: instance.id.externalId,
    name: readString(properties, 'name'),
    description: readString(properties, 'description'),
    startTime: readTimestamp(properties, 'startTime'),
    endTime: readTimestamp(properties, 'endTime'),
    scheduledStartTime: readTimestamp(properties, 'scheduledStartTime'),
    scheduledEndTime: readTimestamp(properties, 'scheduledEndTime'),
  };
}
