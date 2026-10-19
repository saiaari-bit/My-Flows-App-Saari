import type { CogniteClient } from '@cognite/sdk';

import { toCdfServiceError } from './cdfError';
import type { CdmInstance, InstanceId, InstanceListClient } from './cdm';
import {
  INSTANCE_LIST_PAGE_SIZE,
  cdmView,
  linkedToAssetFilter,
  listAllInstances,
  readBoolean,
  readString,
} from './cdm';
import { runCdfCall } from './runCdfCall';

export const TIME_SERIES_VIEW_EXTERNAL_ID = 'CogniteTimeSeries';

type DatapointsApi = CogniteClient['datapoints'];

export type LatestDatapointsParams = Parameters<DatapointsApi['retrieveLatest']>;
export type LatestDatapointsResult = Awaited<ReturnType<DatapointsApi['retrieveLatest']>>;
export type DatapointsRetrieveParams = Parameters<DatapointsApi['retrieve']>[0];
export type DatapointsRetrieveResult = Awaited<ReturnType<DatapointsApi['retrieve']>>;

/** Epoch milliseconds or a `Date`, matching what the SDK accepts for bounds. */
export type TimeBound = number | Date;

/** The row-level fields the selection list (FR-006) and the chart need. */
export type AssetTimeSeries = {
  space: string;
  externalId: string;
  name?: string;
  description?: string;
  /** `numeric` | `string` | `state` — decides whether a series is plottable. */
  type?: string;
  isStep?: boolean;
  sourceUnit?: string;
};

export type Datapoint = {
  /** Epoch milliseconds. */
  timestamp: number;
  value: number | string;
};

export type LatestDatapoint = {
  instanceId?: InstanceId;
  externalId?: string;
  /** `null` when the series exists but has never received a datapoint. */
  datapoint: Datapoint | null;
};

export type SeriesDatapoints = {
  instanceId?: InstanceId;
  externalId?: string;
  isString: boolean;
  unit?: string;
  datapoints: Datapoint[];
};

export interface TimeSeriesService {
  getAssetTimeSeries(assetId: InstanceId): Promise<AssetTimeSeries[]>;
  /** Feeds the chart's default end anchor (FR-008 / AS-9). */
  getLatestDatapoints(seriesIds: InstanceId[]): Promise<LatestDatapoint[]>;
  /** `start` is inclusive and `end` is exclusive, as the CDF endpoint defines them. */
  getDatapoints(seriesIds: InstanceId[], start: TimeBound, end: TimeBound): Promise<SeriesDatapoints[]>;
}

export type TimeSeriesServiceClient = InstanceListClient & {
  datapoints: Pick<DatapointsApi, 'retrieveLatest' | 'retrieve'>;
};

export class CdmTimeSeriesService implements TimeSeriesService {
  constructor(private readonly client: TimeSeriesServiceClient) {}

  /*
   * `CogniteAsset.timeSeries` is a reverse direct relation list, and the
   * `/query` endpoint cannot traverse those inwards. The relationship is owned
   * by `CogniteTimeSeries.assets`, so the read starts from the time series view
   * and filters on that list — docs/cdm-traversal-notes.md §3.
   *
   * `/models/instances/list` has no property selector, so the view's full
   * property set comes back and only the fields above are mapped out of it.
   */
  async getAssetTimeSeries(assetId: InstanceId): Promise<AssetTimeSeries[]> {
    const instances = await listAllInstances(
      this.client,
      {
        instanceType: 'node',
        sources: [{ source: cdmView(TIME_SERIES_VIEW_EXTERNAL_ID) }],
        filter: linkedToAssetFilter(TIME_SERIES_VIEW_EXTERNAL_ID, assetId),
        limit: INSTANCE_LIST_PAGE_SIZE,
      },
      TIME_SERIES_VIEW_EXTERNAL_ID
    );

    return instances.map(toAssetTimeSeries);
  }

  async getLatestDatapoints(seriesIds: InstanceId[]): Promise<LatestDatapoint[]> {
    if (seriesIds.length === 0) return [];

    try {
      /*
       * `ignoreUnknownIds` is required: a shared deep link (FR-004) can name a
       * series that has since been deleted, and one stale id must not blank the
       * chart panel. Unknown ids are simply absent from the response.
       */
      const result = await runCdfCall(() =>
        this.client.datapoints.retrieveLatest(seriesIds.map(toDatapointItem), {
          ignoreUnknownIds: true,
        })
      );

      return result.map((series) => ({
        instanceId: series.instanceId,
        externalId: series.externalId,
        datapoint: toDatapoint(series.datapoints[0]),
      }));
    } catch (error) {
      throw toCdfServiceError(error);
    }
  }

  async getDatapoints(
    seriesIds: InstanceId[],
    start: TimeBound,
    end: TimeBound
  ): Promise<SeriesDatapoints[]> {
    if (seriesIds.length === 0) return [];

    try {
      /*
       * No aggregates and no granularity: SPEC.md CL-004 leaves the aggregation
       * strategy open, and omitting them is the documented way to get raw
       * datapoints. No `limit` either — the endpoint's default and maximum page
       * size are not established, so inventing one would silently truncate.
       */
      const result = await runCdfCall(() =>
        this.client.datapoints.retrieve({
          items: seriesIds.map(toDatapointItem),
          start,
          end,
          ignoreUnknownIds: true,
        })
      );

      const series: DatapointsRetrieveResult[number][] = result;
      return series.map(toSeriesDatapoints);
    } catch (error) {
      throw toCdfServiceError(error);
    }
  }
}

function toAssetTimeSeries(instance: CdmInstance): AssetTimeSeries {
  return {
    space: instance.id.space,
    externalId: instance.id.externalId,
    name: readString(instance.properties, 'name'),
    description: readString(instance.properties, 'description'),
    type: readString(instance.properties, 'type'),
    isStep: readBoolean(instance.properties, 'isStep'),
    sourceUnit: readString(instance.properties, 'sourceUnit'),
  };
}

function toDatapointItem(seriesId: InstanceId): { instanceId: InstanceId } {
  return { instanceId: { space: seriesId.space, externalId: seriesId.externalId } };
}

function toSeriesDatapoints(series: DatapointsRetrieveResult[number]): SeriesDatapoints {
  const points: DatapointsRetrieveResult[number]['datapoints'][number][] = series.datapoints;

  return {
    instanceId: series.instanceId,
    externalId: series.externalId,
    isString: series.isString,
    unit: series.unit,
    datapoints: points.flatMap((point) => {
      const datapoint = toDatapoint(point);
      return datapoint === null ? [] : [datapoint];
    }),
  };
}

/**
 * Aggregate rows carry no `value`. They cannot occur while no aggregate is
 * requested, but the SDK's return type spans both, so they are skipped rather
 * than coerced.
 */
function toDatapoint(
  point: DatapointsRetrieveResult[number]['datapoints'][number] | undefined
): Datapoint | null {
  if (point === undefined) return null;
  if (!('value' in point)) return null;
  return { timestamp: point.timestamp.getTime(), value: point.value };
}
