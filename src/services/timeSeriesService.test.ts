import { CogniteError } from '@cognite/sdk';
import { describe, expect, it, vi } from 'vitest';

import type { InstanceListParams, InstanceListResponse } from './cdm';
import type {
  DatapointsRetrieveParams,
  DatapointsRetrieveResult,
  LatestDatapointsParams,
  LatestDatapointsResult,
  TimeSeriesServiceClient,
} from './timeSeriesService';
import { CdmTimeSeriesService } from './timeSeriesService';

describe(`${CdmTimeSeriesService.name}.getAssetTimeSeries`, () => {
  it('finds the linked series by filtering the time series view on its own assets list', async () => {
    // Arrange
    const { service, list } = buildService({
      seriesNodes: [
        buildTimeSeriesNode('PUMP-1:pressure', {
          name: 'Discharge pressure',
          description: 'Pump discharge',
          type: 'numeric',
          isStep: false,
          sourceUnit: 'bar',
        }),
      ],
    });

    // Act
    const series = await service.getAssetTimeSeries({ space: 'sp', externalId: 'PUMP-1' });

    // Assert
    expect(list.mock.calls[0]?.[0]).toMatchObject({
      instanceType: 'node',
      sources: [{ source: { type: 'view', space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1' } }],
      filter: {
        containsAny: {
          property: ['cdf_cdm', 'CogniteTimeSeries/v1', 'assets'],
          values: [{ space: 'sp', externalId: 'PUMP-1' }],
        },
      },
      limit: 1000,
    });
    expect(series).toEqual([
      {
        space: 'sp',
        externalId: 'PUMP-1:pressure',
        name: 'Discharge pressure',
        description: 'Pump discharge',
        type: 'numeric',
        isStep: false,
        sourceUnit: 'bar',
      },
    ]);
  });

  it('reads from the owning view rather than traversing the asset reverse relation list', async () => {
    const { service, list } = buildService({});

    await service.getAssetTimeSeries({ space: 'sp', externalId: 'PUMP-1' });

    // Starting from CogniteAsset and walking `timeSeries` inwards is a documented
    // API error, so nothing in the request may reference the asset view.
    expect(JSON.stringify(list.mock.calls[0]?.[0])).not.toContain('CogniteAsset');
  });

  it('returns an empty list when the asset has no linked series', async () => {
    const { service } = buildService({});

    expect(await service.getAssetTimeSeries({ space: 'sp', externalId: 'PUMP-1' })).toEqual([]);
  });

  it('reports a forbidden read as a no-access service error', async () => {
    const { service } = buildService({ listError: new CogniteError('Forbidden', 403) });

    await expect(service.getAssetTimeSeries({ space: 'sp', externalId: 'PUMP-1' })).rejects.toMatchObject({
      kind: 'no-access',
      status: 403,
    });
  });
});

describe(`${CdmTimeSeriesService.name}.getLatestDatapoints`, () => {
  it('identifies each series by its data model instance id and tolerates unknown ids', async () => {
    // Arrange
    const { service, retrieveLatest } = buildService({
      latest: [
        {
          id: 1,
          isString: false,
          instanceId: { space: 'sp', externalId: 'PUMP-1:pressure' },
          datapoints: [{ timestamp: new Date(1730000000000), value: 4.2 }],
        },
      ],
    });

    // Act
    const latest = await service.getLatestDatapoints([{ space: 'sp', externalId: 'PUMP-1:pressure' }]);

    // Assert
    expect(retrieveLatest.mock.calls[0]?.[0]).toEqual([
      { instanceId: { space: 'sp', externalId: 'PUMP-1:pressure' } },
    ]);
    expect(retrieveLatest.mock.calls[0]?.[1]).toEqual({ ignoreUnknownIds: true });
    expect(latest).toEqual([
      {
        instanceId: { space: 'sp', externalId: 'PUMP-1:pressure' },
        datapoint: { timestamp: 1730000000000, value: 4.2 },
      },
    ]);
  });

  it('reports a series with no datapoints as null so it contributes no chart end anchor', async () => {
    const { service } = buildService({
      latest: [{ id: 1, isString: false, instanceId: { space: 'sp', externalId: 'quiet' }, datapoints: [] }],
    });

    const latest = await service.getLatestDatapoints([{ space: 'sp', externalId: 'quiet' }]);

    expect(latest).toEqual([{ instanceId: { space: 'sp', externalId: 'quiet' }, datapoint: null }]);
  });

  it('omits series the project no longer has, rather than failing the whole panel', async () => {
    const { service } = buildService({
      latest: [{ id: 1, isString: false, instanceId: { space: 'sp', externalId: 'alive' }, datapoints: [] }],
    });

    const latest = await service.getLatestDatapoints([
      { space: 'sp', externalId: 'alive' },
      { space: 'sp', externalId: 'deleted-by-a-stale-deep-link' },
    ]);

    expect(latest).toHaveLength(1);
    expect(latest[0]?.instanceId?.externalId).toBe('alive');
  });

  it('short-circuits an empty selection without calling CDF', async () => {
    const { service, retrieveLatest } = buildService({});

    expect(await service.getLatestDatapoints([])).toEqual([]);
    expect(retrieveLatest).not.toHaveBeenCalled();
  });
});

describe(`${CdmTimeSeriesService.name}.getDatapoints`, () => {
  it('passes start and end through unchanged, keeping the API inclusive/exclusive semantics', async () => {
    // Arrange
    const { service, retrieve } = buildService({
      datapoints: [
        {
          id: 1,
          isString: false,
          instanceId: { space: 'sp', externalId: 'PUMP-1:pressure' },
          unit: 'bar',
          datapoints: [
            { timestamp: new Date(1730000000000), value: 4.2 },
            { timestamp: new Date(1730000060000), value: 4.4 },
          ],
        },
      ],
    });

    // Act
    const series = await service.getDatapoints(
      [{ space: 'sp', externalId: 'PUMP-1:pressure' }],
      1730000000000,
      1730003600000
    );

    // Assert
    const query = retrieve.mock.calls[0]?.[0];
    expect(query).toEqual({
      items: [{ instanceId: { space: 'sp', externalId: 'PUMP-1:pressure' } }],
      start: 1730000000000,
      end: 1730003600000,
      ignoreUnknownIds: true,
    });
    expect(series).toEqual([
      {
        instanceId: { space: 'sp', externalId: 'PUMP-1:pressure' },
        isString: false,
        unit: 'bar',
        datapoints: [
          { timestamp: 1730000000000, value: 4.2 },
          { timestamp: 1730000060000, value: 4.4 },
        ],
      },
    ]);
  });

  it('requests raw datapoints, with no aggregate, granularity or invented page size', async () => {
    const { service, retrieve } = buildService({});

    await service.getDatapoints([{ space: 'sp', externalId: 'PUMP-1:pressure' }], 0, 1);

    const query = retrieve.mock.calls[0]?.[0];
    expect(query).not.toHaveProperty('aggregates');
    expect(query).not.toHaveProperty('granularity');
    expect(query).not.toHaveProperty('limit');
  });

  it('accepts Date bounds as well as epoch milliseconds', async () => {
    const { service, retrieve } = buildService({});
    const start = new Date(1730000000000);
    const end = new Date(1730003600000);

    await service.getDatapoints([{ space: 'sp', externalId: 'PUMP-1:pressure' }], start, end);

    expect(retrieve.mock.calls[0]?.[0]).toMatchObject({ start, end });
  });

  it('short-circuits an empty selection without calling CDF', async () => {
    const { service, retrieve } = buildService({});

    expect(await service.getDatapoints([], 0, 1)).toEqual([]);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('reports a throttled datapoint read as a transient service error', async () => {
    const { service } = buildService({ datapointsError: new CogniteError('Too many requests', 429) });

    await expect(
      service.getDatapoints([{ space: 'sp', externalId: 'PUMP-1:pressure' }], 0, 1)
    ).rejects.toMatchObject({ kind: 'transient', status: 429 });
  });
});

type ServiceHarnessOptions = {
  seriesNodes?: InstanceListResponse['items'];
  latest?: LatestDatapointsResult;
  datapoints?: DatapointsRetrieveResult;
  listError?: Error;
  datapointsError?: Error;
};

function buildService(options: ServiceHarnessOptions) {
  const list = vi.fn(async (_params: InstanceListParams): Promise<InstanceListResponse> => {
    if (options.listError) throw options.listError;
    return { items: options.seriesNodes ?? [] };
  });

  const retrieveLatest = vi.fn(
    async (..._args: LatestDatapointsParams): Promise<LatestDatapointsResult> => options.latest ?? []
  );

  const retrieve = vi.fn(async (_query: DatapointsRetrieveParams): Promise<DatapointsRetrieveResult> => {
    if (options.datapointsError) throw options.datapointsError;
    return options.datapoints ?? [];
  });

  const client: TimeSeriesServiceClient = {
    instances: { list },
    datapoints: { retrieveLatest, retrieve },
  };

  return { service: new CdmTimeSeriesService(client), client, list, retrieveLatest, retrieve };
}

function buildTimeSeriesNode(
  externalId: string,
  properties: Record<string, string | boolean>
): InstanceListResponse['items'][number] {
  return {
    instanceType: 'node',
    space: 'sp',
    externalId,
    version: 1,
    createdTime: 0,
    lastUpdatedTime: 0,
    properties: { cdf_cdm: { 'CogniteTimeSeries/v1': properties } },
  };
}
