import { CogniteError } from '@cognite/sdk';
import { describe, expect, it, vi } from 'vitest';

import type { ActivityServiceClient } from './activityService';
import { CdmActivityService } from './activityService';
import type { InstanceListParams, InstanceListResponse } from './cdm';

describe(`${CdmActivityService.name}.getAssetActivities`, () => {
  it('finds the linked activities by filtering the activity view on its own assets list', async () => {
    // Arrange
    const { service, list } = buildService({
      activityNodes: [
        buildActivityNode('WO-1', {
          name: 'Replace mechanical seal',
          description: 'Planned maintenance',
          scheduledStartTime: '2026-03-01T08:00:00.000Z',
          scheduledEndTime: '2026-03-01T16:00:00.000Z',
          startTime: 1740816000000,
          endTime: 1740844800000,
        }),
      ],
    });

    // Act
    const activities = await service.getAssetActivities({ space: 'sp', externalId: 'PUMP-1' });

    // Assert
    expect(list.mock.calls[0]?.[0]).toMatchObject({
      instanceType: 'node',
      sources: [{ source: { type: 'view', space: 'cdf_cdm', externalId: 'CogniteActivity', version: 'v1' } }],
      filter: {
        containsAny: {
          property: ['cdf_cdm', 'CogniteActivity/v1', 'assets'],
          values: [{ space: 'sp', externalId: 'PUMP-1' }],
        },
      },
      limit: 1000,
    });
    expect(activities).toEqual([
      {
        space: 'sp',
        externalId: 'WO-1',
        name: 'Replace mechanical seal',
        description: 'Planned maintenance',
        startTime: 1740816000000,
        endTime: 1740844800000,
        scheduledStartTime: Date.parse('2026-03-01T08:00:00.000Z'),
        scheduledEndTime: Date.parse('2026-03-01T16:00:00.000Z'),
      },
    ]);
  });

  it('lists every linked activity unfiltered, per the open question in SPEC.md CL-007', async () => {
    const { service, list } = buildService({
      activityNodes: [buildActivityNode('WO-1', {}), buildActivityNode('WO-2', {})],
    });

    const activities = await service.getAssetActivities({ space: 'sp', externalId: 'PUMP-1' });

    expect(activities.map((activity) => activity.externalId)).toEqual(['WO-1', 'WO-2']);
    expect(list.mock.calls[0]?.[0].filter).not.toHaveProperty('and');
  });

  it('leaves absent schedule timestamps undefined rather than defaulting them', async () => {
    const { service } = buildService({ activityNodes: [buildActivityNode('WO-1', { name: 'Inspection' })] });

    const activities = await service.getAssetActivities({ space: 'sp', externalId: 'PUMP-1' });

    expect(activities[0]).toEqual({
      space: 'sp',
      externalId: 'WO-1',
      name: 'Inspection',
      description: undefined,
      startTime: undefined,
      endTime: undefined,
      scheduledStartTime: undefined,
      scheduledEndTime: undefined,
    });
  });

  it('returns an empty list when the asset has no linked activities', async () => {
    const { service } = buildService({});

    expect(await service.getAssetActivities({ space: 'sp', externalId: 'PUMP-1' })).toEqual([]);
  });

  it('reports a forbidden read as a no-access service error, isolating this panel', async () => {
    const { service } = buildService({ listError: new CogniteError('Forbidden', 403) });

    await expect(service.getAssetActivities({ space: 'sp', externalId: 'PUMP-1' })).rejects.toMatchObject({
      kind: 'no-access',
      status: 403,
    });
  });

  it('reports a query timeout as transient, so the panel can offer a manual refresh', async () => {
    const { service } = buildService({ listError: new CogniteError('Request timeout', 408) });

    await expect(service.getAssetActivities({ space: 'sp', externalId: 'PUMP-1' })).rejects.toMatchObject({
      kind: 'transient',
      status: 408,
    });
  });
});

type ServiceHarnessOptions = {
  activityNodes?: InstanceListResponse['items'];
  listError?: Error;
};

function buildService(options: ServiceHarnessOptions) {
  const list = vi.fn(async (_params: InstanceListParams): Promise<InstanceListResponse> => {
    if (options.listError) throw options.listError;
    return { items: options.activityNodes ?? [] };
  });

  const client: ActivityServiceClient = { instances: { list } };

  return { service: new CdmActivityService(client), client, list };
}

function buildActivityNode(
  externalId: string,
  properties: Record<string, string | number>
): InstanceListResponse['items'][number] {
  return {
    instanceType: 'node',
    space: 'sp',
    externalId,
    version: 1,
    createdTime: 0,
    lastUpdatedTime: 0,
    properties: { cdf_cdm: { 'CogniteActivity/v1': properties } },
  };
}
