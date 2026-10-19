import { vi } from 'vitest';

import type { ActivityService, AssetActivity } from '@/services/activityService';

export function createActivityServiceStub() {
  return {
    getAssetActivities: vi.fn<ActivityService['getAssetActivities']>(() =>
      Promise.resolve([])
    ),
  };
}

export type ActivityServiceStub = ReturnType<typeof createActivityServiceStub>;

export function makeActivity(
  externalId: string,
  overrides: Partial<AssetActivity> = {}
): AssetActivity {
  return { space: 'my-space', externalId, ...overrides };
}
