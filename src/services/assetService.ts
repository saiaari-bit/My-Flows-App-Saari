import { toCdfServiceError } from './cdfError';
import type {
  CdfPostClient,
  CdmInstance,
  InstanceId,
  InstanceListClient,
  InstanceRetrieveClient,
} from './cdm';
import {
  cdmView,
  dedupeByInstanceId,
  isRecord,
  readInstance,
  readInstances,
  readItems,
  readString,
} from './cdm';
import { runCdfCall } from './runCdfCall';

export const ASSET_VIEW_EXTERNAL_ID = 'CogniteAsset';

/** `/models/instances/search` returns at most 1000 results; `/list` pages at 1000. */
export const MAX_ASSET_SEARCH_LIMIT = 1000;
export const DEFAULT_ASSET_SEARCH_LIMIT = 100;

/** The asset fields the header (FR-005) and deep links (FR-003) need. */
export type Asset = {
  space: string;
  externalId: string;
  name?: string;
  description?: string;
  /** Verified CogniteAsset:v1 hierarchy relations, used as header context. */
  parent?: InstanceId;
  root?: InstanceId;
  path?: InstanceId[];
};

/**
 * CDF search matches whole tokens, with only the final token treated as a
 * prefix. `OR` returns instances matching any token, `AND` requires all of
 * them. The service default flips from `OR` to `AND` in November 2026, so the
 * value is always sent explicitly.
 */
export type AssetSearchOperator = 'AND' | 'OR';

export type SearchAssetsOptions = {
  limit?: number;
  operator?: AssetSearchOperator;
};

export interface AssetService {
  /** Matches on plant tag (external id), display name, and description — FR-001. */
  searchAssets(query: string, options?: SearchAssetsOptions): Promise<Asset[]>;
  /** Resolves one asset; `null` means "no such asset", an error means the read failed. */
  getAsset(assetId: InstanceId): Promise<Asset | null>;
}

export type AssetServiceClient = InstanceListClient & InstanceRetrieveClient & CdfPostClient;

export class CdmAssetService implements AssetService {
  constructor(private readonly client: AssetServiceClient) {}

  async searchAssets(query: string, options: SearchAssetsOptions = {}): Promise<Asset[]> {
    const text = query.trim();
    if (text === '') return [];

    const limit = clampLimit(options.limit ?? DEFAULT_ASSET_SEARCH_LIMIT);
    const operator = options.operator ?? 'OR';

    /*
     * Two requests, not one. The plant tag is node identity rather than a
     * searchable text property, so it can only be matched by a filter; whether
     * a single /search call can OR a free-text query together with a filter on
     * ["node","externalId"] is not established by the Cognite documentation.
     * Tag matches lead the merged list because an external-id prefix is the
     * most literal reading of what the user typed.
     */
    const [byTag, byText] = await Promise.all([
      this.searchByTagPrefix(text, limit),
      this.searchByText(text, operator, limit),
    ]);

    return dedupeByInstanceId([...byTag, ...byText]).slice(0, limit);
  }

  async getAsset(assetId: InstanceId): Promise<Asset | null> {
    let items: readonly unknown[];

    try {
      const response = await runCdfCall(() => this.client.instances.retrieve({
        items: [{ instanceType: 'node', space: assetId.space, externalId: assetId.externalId }],
        sources: [{ source: cdmView(ASSET_VIEW_EXTERNAL_ID) }],
      }));
      items = response.items;
    } catch (error) {
      throw toCdfServiceError(error);
    }

    /*
     * `/byids` has no `ignoreUnknownIds` option in the installed SDK: an
     * instance that does not exist is simply absent from `items`. That absence
     * is the "missing asset" signal, and it is deliberately distinct from the
     * throw above, which means the read itself failed.
     */
    for (const item of items) {
      const instance = readInstance(item, ASSET_VIEW_EXTERNAL_ID);
      if (instance === undefined) continue;
      if (instance.id.space !== assetId.space) continue;
      if (instance.id.externalId !== assetId.externalId) continue;
      return toAsset(instance);
    }

    return null;
  }

  private async searchByTagPrefix(text: string, limit: number): Promise<Asset[]> {
    try {
      const response = await runCdfCall(() =>
        this.client.instances.list({
          instanceType: 'node',
          sources: [{ source: cdmView(ASSET_VIEW_EXTERNAL_ID) }],
          filter: { prefix: { property: ['node', 'externalId'], value: text } },
          limit,
        })
      );
      return readInstances(response.items, ASSET_VIEW_EXTERNAL_ID).map(toAsset);
    } catch (error) {
      throw toCdfServiceError(error);
    }
  }

  /*
   * Uses `client.post` rather than `client.instances.search` because the
   * installed @cognite/sdk (10.13.0) omits `operator` from its search request
   * type, and relying on the server-side default would silently change this
   * app's behaviour in November 2026.
   */
  private async searchByText(
    text: string,
    operator: AssetSearchOperator,
    limit: number
  ): Promise<Asset[]> {
    try {
      const response = await runCdfCall(() => this.client.post(
        `/api/v1/projects/${this.client.project}/models/instances/search`,
        {
          data: {
            view: cdmView(ASSET_VIEW_EXTERNAL_ID),
            query: text,
            instanceType: 'node',
            properties: ['name', 'description'],
            operator,
            limit,
          },
        })
      );
      return readInstances(readItems(response.data), ASSET_VIEW_EXTERNAL_ID).map(toAsset);
    } catch (error) {
      throw toCdfServiceError(error);
    }
  }
}

function toAsset(instance: CdmInstance): Asset {
  const asset: Asset = {
    space: instance.id.space,
    externalId: instance.id.externalId,
    name: readString(instance.properties, 'name'),
    description: readString(instance.properties, 'description'),
  };
  const parent = readInstanceId(instance.properties, 'parent');
  const root = readInstanceId(instance.properties, 'root');
  const path = readInstanceIds(instance.properties, 'path');
  if (parent !== undefined) asset.parent = parent;
  if (root !== undefined) asset.root = root;
  if (path !== undefined) asset.path = path;
  return asset;
}

function readInstanceId(
  properties: Record<string, unknown>,
  key: string
): InstanceId | undefined {
  const value = properties[key];
  if (!isRecord(value)) return undefined;
  if (typeof value.space !== 'string' || value.space === '') return undefined;
  if (typeof value.externalId !== 'string' || value.externalId === '') return undefined;
  return { space: value.space, externalId: value.externalId };
}

function readInstanceIds(
  properties: Record<string, unknown>,
  key: string
): InstanceId[] | undefined {
  const value = properties[key];
  if (!Array.isArray(value)) return undefined;
  const ids: InstanceId[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.space !== 'string' || item.space === '') continue;
    if (typeof item.externalId !== 'string' || item.externalId === '') continue;
    ids.push({ space: item.space, externalId: item.externalId });
  }
  return ids;
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) return 1;
  return Math.min(Math.floor(limit), MAX_ASSET_SEARCH_LIMIT);
}
