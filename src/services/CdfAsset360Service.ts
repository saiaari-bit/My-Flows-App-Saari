import type {
  DatapointAggregates,
  Datapoints,
  FilterDefinition,
  NodeOrEdge,
  PropertySortV3,
  ViewReference,
} from '@cognite/sdk';

import {
  signalUnitRelation,
  toAssetMatch,
  toAssetSummary,
  toDocumentFile,
  toSignal,
  toUnitLabel,
  toWorkOrder,
} from '../cdm/mappers';
import { instanceKey } from '../cdm/properties';
import { ACTIVITY_VIEW, ASSET_VIEW, FILE_VIEW, TIME_SERIES_VIEW, UNIT_VIEW, viewProperty } from '../cdm/views';
import type {
  AssetMatch,
  AssetSummary,
  ChartPoint,
  ChartSeries,
  DocumentFile,
  InstanceRef,
  LatestReading,
  Signal,
  WorkOrder,
} from '../domain/asset360Types';
import { rankAssetMatches } from '../domain/rankAssetMatches';
import type { TimeWindow } from '../domain/timeWindow';

import type { Asset360Client, Asset360Service, SignalsResult } from './asset360Service';
import { Asset360Error, LIMITS } from './asset360Service';

type Deps = {
  /** Injected so tests get deterministic work-order statuses. */
  now: () => number;
};

const defaultDeps: Deps = { now: () => Date.now() };

/**
 * Reads the Cognite Core Data Model for one asset at a time.
 *
 * All DMS query construction lives in this file. The asset-to-child links
 * (`timeSeries`, `activities`, `files`) are reverse direct relations targeting
 * lists, which the graph `/query` endpoint cannot traverse, so each child view
 * is looked up directly and filtered on its own `assets` property — the
 * reverse-lookup pattern Cognite documents for this case.
 */
class CdfAsset360Service implements Asset360Service {
  constructor(
    private readonly client: Asset360Client,
    private readonly deps: Deps
  ) {}

  async searchAssets(query: string): Promise<AssetMatch[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [];
    }
    const response = await run('Could not search for assets.', () =>
      this.client.instances.search({
        view: ASSET_VIEW,
        query: trimmed,
        instanceType: 'node',
        properties: ['name', 'description', 'aliases'],
        limit: LIMITS.assetSearch,
      })
    );
    return rankAssetMatches(response.items.map(toAssetMatch), trimmed);
  }

  async getAsset(ref: InstanceRef): Promise<AssetSummary | undefined> {
    const response = await run('Could not load this asset.', () =>
      this.client.instances.retrieve({
        sources: [{ source: ASSET_VIEW }],
        items: [{ instanceType: 'node', space: ref.space, externalId: ref.externalId }],
      })
    );
    const [node] = response.items;
    return node === undefined ? undefined : toAssetSummary(node);
  }

  async getSignals(ref: InstanceRef): Promise<SignalsResult> {
    const response = await run('Could not load time series for this asset.', () =>
      this.client.instances.list({
        instanceType: 'node',
        sources: [{ source: TIME_SERIES_VIEW }],
        filter: relatedToAsset(TIME_SERIES_VIEW, ref),
        sort: [sortBy(TIME_SERIES_VIEW, 'name', 'ascending')],
        limit: LIMITS.signals,
      })
    );

    const nodes = response.items;
    const signals = nodes.map(toSignal);

    // Both enrichments are optional and independent: the signal list is useful
    // without either, so they run together and degrade to a warning on failure.
    const [units, latest] = await Promise.all([
      this.resolveUnits(nodes),
      this.resolveLatestReadings(signals),
    ]);

    return {
      signals: signals.map((signal) => ({
        ...signal,
        unit: signal.unit ?? units.value.get(instanceKey(signal.ref)),
        latest: latest.value.get(instanceKey(signal.ref)),
      })),
      // Concatenated in a fixed order so the warnings do not depend on which
      // of the two concurrent requests failed first.
      warnings: [units.warning, latest.warning].filter(isPresent),
    };
  }

  async getChartSeries(signals: Signal[], window: TimeWindow): Promise<ChartSeries[]> {
    // Only `numeric` series can be aggregated; `string` and `state` cannot.
    const plottable = signals.filter((signal) => signal.kind === 'numeric').slice(0, LIMITS.chartSeries);
    if (plottable.length === 0) {
      return [];
    }

    const response = await run('Could not load chart data for these signals.', () =>
      this.client.datapoints.retrieve({
        items: plottable.map((signal) => ({ instanceId: { ...signal.ref } })),
        start: window.start,
        end: window.end,
        aggregates: ['average'],
        granularity: window.granularity,
        limit: window.pointLimit,
        ignoreUnknownIds: true,
      })
    );

    const pointsBySignal = new Map<string, ChartPoint[]>();
    for (const item of response) {
      const key = keyOfDatapointsItem(item);
      if (key !== undefined) {
        pointsBySignal.set(key, averagePoints(item));
      }
    }

    return plottable.map((signal) => ({
      ref: signal.ref,
      label: signal.label,
      unit: signal.unit,
      points: pointsBySignal.get(instanceKey(signal.ref)) ?? [],
    }));
  }

  async getWorkOrders(ref: InstanceRef): Promise<WorkOrder[]> {
    const response = await run('Could not load work orders for this asset.', () =>
      this.client.instances.list({
        instanceType: 'node',
        sources: [{ source: ACTIVITY_VIEW }],
        filter: relatedToAsset(ACTIVITY_VIEW, ref),
        sort: [sortBy(ACTIVITY_VIEW, 'startTime', 'descending')],
        limit: LIMITS.workOrders,
      })
    );
    const now = this.deps.now();
    return response.items.map((node) => toWorkOrder(node, now));
  }

  async getDocuments(ref: InstanceRef): Promise<DocumentFile[]> {
    const response = await run('Could not load documents for this asset.', () =>
      this.client.instances.list({
        instanceType: 'node',
        sources: [{ source: FILE_VIEW }],
        filter: relatedToAsset(FILE_VIEW, ref),
        sort: [sortBy(FILE_VIEW, 'uploadedTime', 'descending')],
        limit: LIMITS.documents,
      })
    );
    return response.items.map(toDocumentFile);
  }

  async getDocumentDownloadUrl(ref: InstanceRef): Promise<string> {
    const links = await run('Could not open this document.', () =>
      this.client.files.getDownloadUrls([{ instanceId: { ...ref } }])
    );
    const [link] = links;
    if (link === undefined) {
      throw new Asset360Error('This document has no downloadable content in CDF.');
    }
    return link.downloadUrl;
  }

  /** Resolves `CogniteUnit` labels for signals that have no `sourceUnit`. */
  private async resolveUnits(nodes: NodeOrEdge[]): Promise<Enrichment<string>> {
    const unitBySignal = new Map<string, InstanceRef>();
    for (const node of nodes) {
      const unitRef = signalUnitRelation(node);
      if (unitRef !== undefined) {
        unitBySignal.set(instanceKey({ space: node.space, externalId: node.externalId }), unitRef);
      }
    }
    if (unitBySignal.size === 0) {
      return { value: new Map() };
    }

    const uniqueUnits = new Map<string, InstanceRef>();
    for (const unitRef of unitBySignal.values()) {
      uniqueUnits.set(instanceKey(unitRef), unitRef);
    }

    try {
      const response = await this.client.instances.retrieve({
        sources: [{ source: UNIT_VIEW }],
        items: [...uniqueUnits.values()].map((unitRef) => ({
          instanceType: 'node' as const,
          space: unitRef.space,
          externalId: unitRef.externalId,
        })),
      });

      const labelByUnit = new Map<string, string>();
      for (const node of response.items) {
        const label = toUnitLabel(node);
        if (label !== undefined) {
          labelByUnit.set(instanceKey({ space: node.space, externalId: node.externalId }), label);
        }
      }

      const result = new Map<string, string>();
      for (const [signalKey, unitRef] of unitBySignal) {
        const label = labelByUnit.get(instanceKey(unitRef));
        if (label !== undefined) {
          result.set(signalKey, label);
        }
      }
      return { value: result };
    } catch (cause) {
      console.error('Asset 360: failed to resolve time series units', cause);
      return {
        value: new Map(),
        warning: 'Units could not be loaded, so some signals are shown without a unit.',
      };
    }
  }

  private async resolveLatestReadings(signals: Signal[]): Promise<Enrichment<LatestReading>> {
    if (signals.length === 0) {
      return { value: new Map() };
    }
    try {
      const response = await this.client.datapoints.retrieveLatest(
        signals.map((signal) => ({ instanceId: { ...signal.ref }, before: 'now' })),
        { ignoreUnknownIds: true }
      );

      const readings = new Map<string, LatestReading>();
      for (const item of response) {
        const key = keyOfDatapointsItem(item);
        const [point] = item.datapoints;
        if (key !== undefined && point !== undefined) {
          readings.set(key, { timestamp: point.timestamp.getTime(), value: point.value });
        }
      }
      return { value: readings };
    } catch (cause) {
      console.error('Asset 360: failed to load latest readings', cause);
      return {
        value: new Map(),
        warning: 'Latest readings could not be loaded. The signal list is still complete.',
      };
    }
  }
}

/** An optional signal enrichment: whatever resolved, plus why some is missing. */
type Enrichment<T> = {
  value: Map<string, T>;
  warning?: string;
};

export function createAsset360Service(
  client: Asset360Client,
  overrides?: Partial<Deps>
): Asset360Service {
  return new CdfAsset360Service(client, { ...defaultDeps, ...overrides });
}

/**
 * Matches instances of `view` whose list-valued `assets` direct relation
 * contains the given asset. This is the documented reverse lookup for reverse
 * direct relations that target lists.
 */
function relatedToAsset(view: ViewReference, asset: InstanceRef): FilterDefinition {
  return {
    containsAny: {
      property: viewProperty(view, 'assets'),
      values: [{ space: asset.space, externalId: asset.externalId }],
    },
  };
}

function sortBy(
  view: ViewReference,
  property: string,
  direction: 'ascending' | 'descending'
): PropertySortV3 {
  // Instances missing the sort property sort last, so they never head the list.
  return { property: viewProperty(view, property), direction, nullsFirst: false };
}

/** Datapoint responses identify the series by the instance id that was requested. */
function keyOfDatapointsItem(item: DatapointAggregates | Datapoints): string | undefined {
  return item.instanceId === undefined ? undefined : instanceKey(item.instanceId);
}

function averagePoints(item: DatapointAggregates | Datapoints): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const datapoint of item.datapoints) {
    const value = numericPointValue(datapoint);
    if (value !== undefined) {
      points.push({ timestamp: datapoint.timestamp.getTime(), value });
    }
  }
  return points;
}

/**
 * Reads a numeric value out of a datapoint. `datapoints.retrieve` returns
 * aggregate points carrying `average` when `aggregates` is set, and raw points
 * carrying `value` otherwise, so both shapes are handled.
 */
function numericPointValue(datapoint: object): number | undefined {
  const fields: Record<string, unknown> = { ...datapoint };
  for (const candidate of [fields.average, fields.value]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined;
}

/** Wraps a CDF call so the UI only ever sees a message it can show a user. */
async function run<T>(userMessage: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (cause) {
    console.error(`Asset 360: ${userMessage}`, cause);
    throw new Asset360Error(userMessage, cause);
  }
}
