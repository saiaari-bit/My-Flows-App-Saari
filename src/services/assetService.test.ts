import { CogniteError } from '@cognite/sdk';
import { describe, expect, it, vi } from 'vitest';

import type { AssetServiceClient } from './assetService';
import { CdmAssetService, MAX_ASSET_SEARCH_LIMIT } from './assetService';
import { CdfServiceError } from './cdfError';
import type {
  CdfPostOptions,
  InstanceListParams,
  InstanceListResponse,
  InstanceRetrieveParams,
  InstanceRetrieveResponse,
} from './cdm';
import { isRecord } from './cdm';

describe(`${CdmAssetService.name}.searchAssets`, () => {
  it('returns assets matched on name and description, mapped to identity plus header fields', async () => {
    // Arrange
    const { service, post } = buildService({
      searchItems: [buildAssetNode('PUMP-1', { name: 'Pump 21', description: 'Feed water pump' })],
    });

    // Act
    const assets = await service.searchAssets('pump');

    // Assert
    expect(assets).toEqual([
      { space: 'sp', externalId: 'PUMP-1', name: 'Pump 21', description: 'Feed water pump' },
    ]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('sets the search operator explicitly, because the CDF default changes in November 2026', async () => {
    const { service, post } = buildService({});

    await service.searchAssets('pump 21', { operator: 'AND' });

    expect(readSearchBody(post.mock.calls[0]?.[1])).toMatchObject({
      view: { type: 'view', space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' },
      query: 'pump 21',
      instanceType: 'node',
      properties: ['name', 'description'],
      operator: 'AND',
    });
  });

  it('defaults to the OR operator so a search box keeps broad recall', async () => {
    const { service, post } = buildService({});

    await service.searchAssets('pump 21');

    expect(readSearchBody(post.mock.calls[0]?.[1])?.operator).toBe('OR');
  });

  it('matches a plant tag with a prefix filter on the node external id, not on a text property', async () => {
    // Arrange
    const { service, list } = buildService({
      tagItems: [buildAssetNode('23-PT-92', { name: 'Pressure transmitter' })],
    });

    // Act
    const assets = await service.searchAssets('23-PT-92');

    // Assert
    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]?.[0]).toMatchObject({
      instanceType: 'node',
      sources: [{ source: { type: 'view', space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' } }],
      filter: { prefix: { property: ['node', 'externalId'], value: '23-PT-92' } },
    });
    expect(assets.map((asset) => asset.externalId)).toEqual(['23-PT-92']);
  });

  it('de-duplicates an asset returned by both the tag and the free-text request', async () => {
    const { service } = buildService({
      tagItems: [buildAssetNode('PUMP-1', { name: 'Pump 21' })],
      searchItems: [
        buildAssetNode('PUMP-1', { name: 'Pump 21' }),
        buildAssetNode('PUMP-2', { name: 'Pump 22' }),
      ],
    });

    const assets = await service.searchAssets('pump');

    expect(assets.map((asset) => asset.externalId)).toEqual(['PUMP-1', 'PUMP-2']);
  });

  it('trims the query and returns nothing without calling CDF when it is blank', async () => {
    const { service, list, post } = buildService({});

    expect(await service.searchAssets('   ')).toEqual([]);
    expect(list).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('clamps the requested limit to the documented 1000-result ceiling', async () => {
    const { service, list, post } = buildService({});

    await service.searchAssets('pump', { limit: 5000 });

    expect(readSearchBody(post.mock.calls[0]?.[1])?.limit).toBe(MAX_ASSET_SEARCH_LIMIT);
    expect(list.mock.calls[0]?.[0].limit).toBe(MAX_ASSET_SEARCH_LIMIT);
  });

  it('caps the merged result at the requested limit', async () => {
    const { service } = buildService({
      tagItems: [buildAssetNode('PUMP-1', {})],
      searchItems: [buildAssetNode('PUMP-2', {}), buildAssetNode('PUMP-3', {})],
    });

    const assets = await service.searchAssets('pump', { limit: 2 });

    expect(assets.map((asset) => asset.externalId)).toEqual(['PUMP-1', 'PUMP-2']);
  });

  it('ignores malformed entries in a response rather than inventing an identity', async () => {
    const { service } = buildService({ searchItems: [{ externalId: 'no-space' }, buildAssetNode('PUMP-1', {})] });

    const assets = await service.searchAssets('pump');

    expect(assets.map((asset) => asset.externalId)).toEqual(['PUMP-1']);
  });

  it('reports a forbidden search as a no-access service error', async () => {
    const { service } = buildService({ searchError: new CogniteError('Insufficient access rights', 403) });

    await expect(service.searchAssets('pump')).rejects.toMatchObject({
      name: CdfServiceError.name,
      kind: 'no-access',
      status: 403,
    });
  });

  it('reports a throttled search as a transient service error', async () => {
    const { service } = buildService({ searchError: new CogniteError('Too many requests', 429) });

    await expect(service.searchAssets('pump')).rejects.toMatchObject({ kind: 'transient', status: 429 });
  });
});

describe(`${CdmAssetService.name}.getAsset`, () => {
  it('retrieves the asset through the CogniteAsset view and returns identity, name and description', async () => {
    // Arrange
    const { service, retrieve } = buildService({
      retrieveItems: [buildAssetNode('PUMP-1', { name: 'Pump 21', description: 'Feed water pump' })],
    });

    // Act
    const asset = await service.getAsset({ space: 'sp', externalId: 'PUMP-1' });

    // Assert
    expect(asset).toEqual({
      space: 'sp',
      externalId: 'PUMP-1',
      name: 'Pump 21',
      description: 'Feed water pump',
    });
    expect(retrieve.mock.calls[0]?.[0]).toEqual({
      items: [{ instanceType: 'node', space: 'sp', externalId: 'PUMP-1' }],
      sources: [{ source: { type: 'view', space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' } }],
    });
  });

  it('returns verified parent, root and path relations for header hierarchy context', async () => {
    const { service } = buildService({
      retrieveItems: [
        buildAssetNode('PUMP-1', {
          name: 'Pump 21',
          parent: { space: 'sp', externalId: 'AREA-A' },
          root: { space: 'sp', externalId: 'PLANT' },
          path: [
            { space: 'sp', externalId: 'PLANT' },
            { space: 'sp', externalId: 'AREA-A' },
          ],
        }),
      ],
    });

    const asset = await service.getAsset({ space: 'sp', externalId: 'PUMP-1' });

    expect(asset).toMatchObject({
      parent: { space: 'sp', externalId: 'AREA-A' },
      root: { space: 'sp', externalId: 'PLANT' },
      path: [
        { space: 'sp', externalId: 'PLANT' },
        { space: 'sp', externalId: 'AREA-A' },
      ],
    });
  });

  it('returns null for a missing asset, since byids omits items it cannot resolve', async () => {
    const { service } = buildService({ retrieveItems: [] });

    expect(await service.getAsset({ space: 'sp', externalId: 'gone' })).toBeNull();
  });

  it('returns null when the response carries a different instance than the one requested', async () => {
    const { service } = buildService({ retrieveItems: [buildAssetNode('OTHER', {})] });

    expect(await service.getAsset({ space: 'sp', externalId: 'PUMP-1' })).toBeNull();
  });

  it('distinguishes a transport failure from a missing asset by throwing', async () => {
    const { service } = buildService({ retrieveError: new CogniteError('Service unavailable', 503) });

    await expect(service.getAsset({ space: 'sp', externalId: 'PUMP-1' })).rejects.toMatchObject({
      name: CdfServiceError.name,
      kind: 'transient',
    });
  });

  it('surfaces a network failure with no status as a generic service error', async () => {
    const { service } = buildService({ retrieveError: new TypeError('Failed to fetch') });

    await expect(service.getAsset({ space: 'sp', externalId: 'PUMP-1' })).rejects.toMatchObject({
      kind: 'unknown',
      status: undefined,
    });
  });
});

type ServiceHarnessOptions = {
  tagItems?: unknown[];
  searchItems?: unknown[];
  retrieveItems?: unknown[];
  searchError?: Error;
  retrieveError?: Error;
};

function buildService(options: ServiceHarnessOptions) {
  const list = vi.fn(async (_params: InstanceListParams): Promise<InstanceListResponse> => {
    return { items: readNodes(options.tagItems) };
  });

  const retrieve = vi.fn(async (_params: InstanceRetrieveParams): Promise<InstanceRetrieveResponse> => {
    if (options.retrieveError) throw options.retrieveError;
    return { items: readNodes(options.retrieveItems) };
  });

  const post = vi.fn(async (_path: string, _options?: CdfPostOptions): Promise<{ data: unknown }> => {
    if (options.searchError) throw options.searchError;
    return { data: { items: options.searchItems ?? [] } };
  });

  const client: AssetServiceClient = { instances: { list, retrieve }, post, project: 'test-project' };

  return { service: new CdmAssetService(client), client, list, retrieve, post };
}

/**
 * The SDK types list/retrieve responses as `NodeOrEdge[]`; the fixtures here are
 * deliberately plain objects so the same shape can be fed through the raw
 * `client.post` path, which is typed as `unknown`.
 */
function readNodes(items: unknown[] | undefined): InstanceListResponse['items'] {
  const nodes: InstanceListResponse['items'] = [];
  for (const item of items ?? []) {
    if (isNode(item)) nodes.push(item);
  }
  return nodes;
}

function isNode(value: unknown): value is InstanceListResponse['items'][number] {
  return typeof value === 'object' && value !== null && 'instanceType' in value;
}

function buildAssetNode(externalId: string, properties: Record<string, unknown>) {
  return {
    instanceType: 'node',
    space: 'sp',
    externalId,
    version: 1,
    createdTime: 0,
    lastUpdatedTime: 0,
    properties: { cdf_cdm: { 'CogniteAsset/v1': properties } },
  };
}

function readSearchBody(options: CdfPostOptions | undefined): Record<string, unknown> | undefined {
  const data = options?.data;
  return isRecord(data) ? data : undefined;
}
