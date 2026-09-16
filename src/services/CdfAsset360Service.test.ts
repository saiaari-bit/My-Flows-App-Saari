import type {
  ByIdsResponse,
  DatapointAggregates,
  Datapoints,
  DatapointsMultiQuery,
  FileLink,
  IdEitherWithInstance,
  LatestDataBeforeRequest,
  ListOfSpaceExternalIdsRequestWithTyping,
  NodeAndEdgeCollectionResponseWithCursorV3Response,
  NodeOrEdgeListRequestV3,
  NodeOrEdgeSearchRequest,
} from '@cognite/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cdmNode, TEST_SPACE } from '../__mocks__/cdmNodes';
import { ACTIVITY_VIEW, ASSET_VIEW, FILE_VIEW, TIME_SERIES_VIEW, UNIT_VIEW } from '../cdm/views';
import type { InstanceRef, Signal } from '../domain/asset360Types';
import { resolveTimeWindow } from '../domain/timeWindow';

import { Asset360Error, type Asset360Client } from './asset360Service';
import { createAsset360Service } from './CdfAsset360Service';

const NOW = Date.parse('2026-03-10T12:00:00Z');
const ASSET: InstanceRef = { space: TEST_SPACE, externalId: '23-HA-9114' };

describe('CdfAsset360Service', () => {
  let client: MockClient;

  beforeEach(() => {
    client = makeClient();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('searchAssets', () => {
    it('searches the CogniteAsset view restricted to its text properties', async () => {
      client.instances.search.mockResolvedValue(items([cdmNode(ASSET_VIEW, 'a1', { name: 'Pump' })]));

      await createAsset360Service(client).searchAssets('  pump  ');

      expect(client.instances.search).toHaveBeenCalledWith({
        view: ASSET_VIEW,
        query: 'pump',
        instanceType: 'node',
        properties: ['name', 'description', 'aliases'],
        limit: 25,
      });
    });

    it('does not call CDF for an empty query', async () => {
      const results = await createAsset360Service(client).searchAssets('   ');

      expect(results).toEqual([]);
      expect(client.instances.search).not.toHaveBeenCalled();
    });

    it('returns ranked matches with the exact tag first', async () => {
      client.instances.search.mockResolvedValue(
        items([
          cdmNode(ASSET_VIEW, 'a1', { name: '23-HA-9114-B' }),
          cdmNode(ASSET_VIEW, 'a2', { name: '23-HA-9114' }),
        ])
      );

      const results = await createAsset360Service(client).searchAssets('23-HA-9114');

      expect(results.map((match) => match.label)).toEqual(['23-HA-9114', '23-HA-9114-B']);
    });

    it('raises a displayable error when the search fails', async () => {
      client.instances.search.mockRejectedValue(new Error('403 Forbidden'));

      await expectDisplayableError(
        createAsset360Service(client).searchAssets('pump'),
        'Could not search for assets.'
      );
    });
  });

  describe('getAsset', () => {
    it('retrieves the asset through the CogniteAsset view', async () => {
      client.instances.retrieve.mockResolvedValue(items([cdmNode(ASSET_VIEW, ASSET.externalId, { name: 'Pump' })]));

      const asset = await createAsset360Service(client).getAsset(ASSET);

      expect(client.instances.retrieve).toHaveBeenCalledWith({
        sources: [{ source: ASSET_VIEW }],
        items: [{ instanceType: 'node', space: ASSET.space, externalId: ASSET.externalId }],
      });
      expect(asset?.label).toBe('Pump');
    });

    it('reports an unknown asset as undefined rather than throwing', async () => {
      client.instances.retrieve.mockResolvedValue(items([]));

      await expect(createAsset360Service(client).getAsset(ASSET)).resolves.toBeUndefined();
    });
  });

  describe('getSignals', () => {
    it('finds related time series with containsAny on the view assets property', async () => {
      client.instances.list.mockResolvedValue(items([]));

      await createAsset360Service(client).getSignals(ASSET);

      expect(client.instances.list).toHaveBeenCalledWith({
        instanceType: 'node',
        sources: [{ source: TIME_SERIES_VIEW }],
        filter: {
          containsAny: {
            property: ['cdf_cdm', 'CogniteTimeSeries/v1', 'assets'],
            values: [{ space: ASSET.space, externalId: ASSET.externalId }],
          },
        },
        sort: [
          {
            property: ['cdf_cdm', 'CogniteTimeSeries/v1', 'name'],
            direction: 'ascending',
            nullsFirst: false,
          },
        ],
        limit: 25,
      });
    });

    it('attaches the latest reading to each signal', async () => {
      client.instances.list.mockResolvedValue(
        items([cdmNode(TIME_SERIES_VIEW, 'ts-1', { name: 'Pressure', type: 'numeric', sourceUnit: 'bar' })])
      );
      client.datapoints.retrieveLatest.mockResolvedValue([
        datapointsItem({ space: TEST_SPACE, externalId: 'ts-1' }, [{ timestamp: new Date(NOW), value: 4.2 }]),
      ]);

      const result = await createAsset360Service(client).getSignals(ASSET);

      expect(client.datapoints.retrieveLatest).toHaveBeenCalledWith(
        [{ instanceId: { space: TEST_SPACE, externalId: 'ts-1' }, before: 'now' }],
        { ignoreUnknownIds: true }
      );
      expect(result.signals[0]?.latest).toEqual({ timestamp: NOW, value: 4.2 });
      expect(result.warnings).toEqual([]);
    });

    it('resolves the unit relation only for signals with no sourceUnit', async () => {
      client.instances.list.mockResolvedValue(
        items([
          cdmNode(TIME_SERIES_VIEW, 'ts-1', {
            type: 'numeric',
            unit: { space: 'cdf_cdm_units', externalId: 'pressure:bar' },
          }),
          cdmNode(TIME_SERIES_VIEW, 'ts-2', { type: 'numeric', sourceUnit: 'degC' }),
        ])
      );
      client.instances.retrieve.mockResolvedValue(
        items([cdmNode(UNIT_VIEW, 'pressure:bar', { symbol: 'bar' }, 'cdf_cdm_units')])
      );

      const result = await createAsset360Service(client).getSignals(ASSET);

      expect(client.instances.retrieve).toHaveBeenCalledWith({
        sources: [{ source: UNIT_VIEW }],
        items: [{ instanceType: 'node', space: 'cdf_cdm_units', externalId: 'pressure:bar' }],
      });
      expect(result.signals.map((signal) => signal.unit)).toEqual(['bar', 'degC']);
    });

    it('keeps the signal list when the latest readings call fails', async () => {
      client.instances.list.mockResolvedValue(items([cdmNode(TIME_SERIES_VIEW, 'ts-1', { type: 'numeric' })]));
      client.datapoints.retrieveLatest.mockRejectedValue(new Error('500'));

      const result = await createAsset360Service(client).getSignals(ASSET);

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0]?.latest).toBeUndefined();
      expect(result.warnings).toHaveLength(1);
    });

    it('keeps the signal list when the unit lookup fails', async () => {
      client.instances.list.mockResolvedValue(
        items([
          cdmNode(TIME_SERIES_VIEW, 'ts-1', {
            type: 'numeric',
            unit: { space: 'cdf_cdm_units', externalId: 'pressure:bar' },
          }),
        ])
      );
      client.instances.retrieve.mockRejectedValue(new Error('403'));

      const result = await createAsset360Service(client).getSignals(ASSET);

      expect(result.signals).toHaveLength(1);
      expect(result.signals[0]?.unit).toBeUndefined();
      expect(result.warnings).toHaveLength(1);
    });

    it('warns about both enrichments in a stable order when both fail', async () => {
      // Arrange: a signal needing a unit lookup, with both enrichments failing.
      client.instances.list.mockResolvedValue(
        items([
          cdmNode(TIME_SERIES_VIEW, 'ts-1', {
            type: 'numeric',
            unit: { space: 'cdf_cdm_units', externalId: 'pressure:bar' },
          }),
        ])
      );
      client.instances.retrieve.mockRejectedValue(new Error('403'));
      client.datapoints.retrieveLatest.mockRejectedValue(new Error('500'));

      // Act
      const result = await createAsset360Service(client).getSignals(ASSET);

      // Assert: units first, then readings, regardless of which rejected first.
      expect(result.warnings).toEqual([
        'Units could not be loaded, so some signals are shown without a unit.',
        'Latest readings could not be loaded. The signal list is still complete.',
      ]);
      expect(result.signals).toHaveLength(1);
    });

    it('raises a displayable error when listing time series fails', async () => {
      client.instances.list.mockRejectedValue(new Error('500'));

      await expectDisplayableError(
        createAsset360Service(client).getSignals(ASSET),
        'Could not load time series for this asset.'
      );
    });
  });

  describe('getChartSeries', () => {
    const window = resolveTimeWindow('24h', NOW);

    it('requests average aggregates by instance id for numeric signals only', async () => {
      client.datapoints.retrieve.mockResolvedValue([
        aggregatesItem({ space: TEST_SPACE, externalId: 'ts-1' }, [
          { timestamp: new Date(NOW), average: 4.2 },
        ]),
      ]);

      const series = await createAsset360Service(client).getChartSeries(
        [signal('ts-1', 'numeric'), signal('ts-2', 'string'), signal('ts-3', 'state')],
        window
      );

      expect(client.datapoints.retrieve).toHaveBeenCalledWith({
        items: [{ instanceId: { space: TEST_SPACE, externalId: 'ts-1' } }],
        start: window.start,
        end: window.end,
        aggregates: ['average'],
        granularity: '5m',
        limit: window.pointLimit,
        ignoreUnknownIds: true,
      });
      expect(series).toEqual([
        {
          ref: { space: TEST_SPACE, externalId: 'ts-1' },
          label: 'ts-1',
          unit: 'bar',
          points: [{ timestamp: NOW, value: 4.2 }],
        },
      ]);
    });

    it('caps the number of plotted series', async () => {
      client.datapoints.retrieve.mockResolvedValue([]);

      await createAsset360Service(client).getChartSeries(
        ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => signal(id, 'numeric')),
        window
      );

      const [query] = client.datapoints.retrieve.mock.calls[0] ?? [];
      expect(query?.items).toHaveLength(4);
    });

    it('does not call CDF when no signal can be aggregated', async () => {
      const series = await createAsset360Service(client).getChartSeries([signal('ts-1', 'string')], window);

      expect(series).toEqual([]);
      expect(client.datapoints.retrieve).not.toHaveBeenCalled();
    });

    it('returns an empty point list for a signal that reported nothing', async () => {
      client.datapoints.retrieve.mockResolvedValue([]);

      const series = await createAsset360Service(client).getChartSeries([signal('ts-1', 'numeric')], window);

      expect(series[0]?.points).toEqual([]);
    });
  });

  describe('getWorkOrders', () => {
    it('lists activities newest first, with unscheduled ones last', async () => {
      client.instances.list.mockResolvedValue(items([]));

      await createAsset360Service(client, { now: () => NOW }).getWorkOrders(ASSET);

      expect(client.instances.list).toHaveBeenCalledWith({
        instanceType: 'node',
        sources: [{ source: ACTIVITY_VIEW }],
        filter: {
          containsAny: {
            property: ['cdf_cdm', 'CogniteActivity/v1', 'assets'],
            values: [{ space: ASSET.space, externalId: ASSET.externalId }],
          },
        },
        sort: [
          {
            property: ['cdf_cdm', 'CogniteActivity/v1', 'startTime'],
            direction: 'descending',
            nullsFirst: false,
          },
        ],
        limit: 50,
      });
    });

    it('derives status against the injected clock', async () => {
      client.instances.list.mockResolvedValue(
        items([cdmNode(ACTIVITY_VIEW, 'wo-1', { name: 'Replace seal', startTime: NOW - 1000 })])
      );

      const orders = await createAsset360Service(client, { now: () => NOW }).getWorkOrders(ASSET);

      expect(orders[0]?.status).toBe('inProgress');
    });

    it('raises a displayable error when listing activities fails', async () => {
      client.instances.list.mockRejectedValue(new Error('500'));

      await expectDisplayableError(
        createAsset360Service(client).getWorkOrders(ASSET),
        'Could not load work orders for this asset.'
      );
    });
  });

  describe('getDocuments', () => {
    it('lists files by upload time, newest first', async () => {
      client.instances.list.mockResolvedValue(items([]));

      await createAsset360Service(client).getDocuments(ASSET);

      expect(client.instances.list).toHaveBeenCalledWith({
        instanceType: 'node',
        sources: [{ source: FILE_VIEW }],
        filter: {
          containsAny: {
            property: ['cdf_cdm', 'CogniteFile/v1', 'assets'],
            values: [{ space: ASSET.space, externalId: ASSET.externalId }],
          },
        },
        sort: [
          {
            property: ['cdf_cdm', 'CogniteFile/v1', 'uploadedTime'],
            direction: 'descending',
            nullsFirst: false,
          },
        ],
        limit: 50,
      });
    });

    it('raises a displayable error when listing files fails', async () => {
      client.instances.list.mockRejectedValue(new Error('500'));

      await expectDisplayableError(
        createAsset360Service(client).getDocuments(ASSET),
        'Could not load documents for this asset.'
      );
    });
  });

  describe('getDocumentDownloadUrl', () => {
    it('asks the files API for a download URL by instance id', async () => {
      const ref = { space: TEST_SPACE, externalId: 'file-1' };
      client.files.getDownloadUrls.mockResolvedValue([
        { instanceId: ref, downloadUrl: 'https://files.example.test/file-1' },
      ]);

      const url = await createAsset360Service(client).getDocumentDownloadUrl(ref);

      expect(client.files.getDownloadUrls).toHaveBeenCalledWith([{ instanceId: ref }]);
      expect(url).toBe('https://files.example.test/file-1');
    });

    it('explains the problem when CDF returns no link', async () => {
      client.files.getDownloadUrls.mockResolvedValue([]);

      await expectDisplayableError(
        createAsset360Service(client).getDocumentDownloadUrl({ space: TEST_SPACE, externalId: 'file-1' }),
        'This document has no downloadable content in CDF.'
      );
    });

    it('raises a displayable error when the files API fails', async () => {
      client.files.getDownloadUrls.mockRejectedValue(new Error('404'));

      await expectDisplayableError(
        createAsset360Service(client).getDocumentDownloadUrl({ space: TEST_SPACE, externalId: 'file-1' }),
        'Could not open this document.'
      );
    });
  });
});

/**
 * Asserts the call failed with copy the UI is allowed to render. The wrapped
 * original error is deliberately outside the assertion.
 */
async function expectDisplayableError(promise: Promise<unknown>, message: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(Asset360Error);
  await expect(promise).rejects.toThrow(message);
}

type MockClient = {
  instances: {
    search: ReturnType<typeof vi.fn<(params: NodeOrEdgeSearchRequest) => Promise<ByIdsResponse>>>;
    list: ReturnType<
      typeof vi.fn<(params: NodeOrEdgeListRequestV3) => Promise<NodeAndEdgeCollectionResponseWithCursorV3Response>>
    >;
    retrieve: ReturnType<
      typeof vi.fn<(params: ListOfSpaceExternalIdsRequestWithTyping) => Promise<ByIdsResponse>>
    >;
  };
  datapoints: {
    retrieve: ReturnType<
      typeof vi.fn<(query: DatapointsMultiQuery) => Promise<DatapointAggregates[] | Datapoints[]>>
    >;
    retrieveLatest: ReturnType<typeof vi.fn<(items: LatestDataBeforeRequest[]) => Promise<Datapoints[]>>>;
  };
  files: {
    getDownloadUrls: ReturnType<
      typeof vi.fn<(ids: IdEitherWithInstance[]) => Promise<(FileLink & IdEitherWithInstance)[]>>
    >;
  };
} & Asset360Client;

function makeClient(): MockClient {
  return {
    instances: {
      search: vi.fn(() => Promise.resolve(items([]))),
      list: vi.fn(() => Promise.resolve(items([]))),
      retrieve: vi.fn(() => Promise.resolve(items([]))),
    },
    datapoints: {
      retrieve: vi.fn(() => Promise.resolve<DatapointAggregates[]>([])),
      retrieveLatest: vi.fn(() => Promise.resolve<Datapoints[]>([])),
    },
    files: {
      getDownloadUrls: vi.fn(() => Promise.resolve([])),
    },
  };
}

function items(nodes: ByIdsResponse['items']): ByIdsResponse & NodeAndEdgeCollectionResponseWithCursorV3Response {
  return { items: nodes };
}

function signal(externalId: string, kind: Signal['kind']): Signal {
  return {
    ref: { space: TEST_SPACE, externalId },
    label: externalId,
    kind,
    unit: 'bar',
  };
}

function datapointsItem(
  instanceId: InstanceRef,
  datapoints: { timestamp: Date; value: number }[]
): Datapoints {
  return { id: 1, instanceId, isString: false, datapoints };
}

function aggregatesItem(
  instanceId: InstanceRef,
  datapoints: { timestamp: Date; average: number }[]
): DatapointAggregates {
  return { id: 1, instanceId, isString: false, isStep: false, datapoints };
}
