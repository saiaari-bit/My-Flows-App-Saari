import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AssetServiceClient } from './assetService';
import type {
  CdfPostOptions,
  InstanceListParams,
  InstanceListResponse,
  InstanceRetrieveParams,
  InstanceRetrieveResponse,
} from './cdm';
import type { AssetServiceContextType } from './useAssetService';
import { AssetServiceContext, DEFAULT_ASSET_SERVICE_DEPS, useAssetService } from './useAssetService';

import { createAssetServiceStub } from '@/__mocks__/assetService';

describe(useAssetService.name, () => {
  it('builds a CDM-backed service from the injected SDK client', async () => {
    // Arrange
    const client = makeClient([
      {
        instanceType: 'node',
        space: 'my-space',
        externalId: 'PUMP-001',
        properties: { cdf_cdm: { 'CogniteAsset/v1': { name: 'Feed water pump' } } },
      },
    ]);
    const { result } = renderHook(() => useAssetService(), {
      wrapper: makeWrapper({ useCogniteSdk: () => client }),
    });

    // Act
    const assets = await result.current.searchAssets('PUMP');

    // Assert
    expect(assets).toEqual([
      { space: 'my-space', externalId: 'PUMP-001', name: 'Feed water pump', description: undefined },
    ]);
  });

  it('keeps the same service instance while the client is unchanged', () => {
    const client = makeClient([]);
    const { result, rerender } = renderHook(() => useAssetService(), {
      wrapper: makeWrapper({ useCogniteSdk: () => client }),
    });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('returns the service implementation supplied through the context', () => {
    const stub = createAssetServiceStub();

    const { result } = renderHook(() => useAssetService(), {
      wrapper: makeWrapper({ useAssetService: () => stub }),
    });

    expect(result.current).toBe(stub);
  });
});

function makeWrapper(overrides: Partial<AssetServiceContextType>) {
  const value: AssetServiceContextType = { ...DEFAULT_ASSET_SERVICE_DEPS, ...overrides };
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AssetServiceContext.Provider value={value}>{children}</AssetServiceContext.Provider>;
  };
}

function makeClient(items: unknown[]): AssetServiceClient {
  const list = vi.fn(
    (_params: InstanceListParams): Promise<InstanceListResponse> =>
      Promise.resolve({ items: readNodes(items) })
  );
  const retrieve = vi.fn(
    (_params: InstanceRetrieveParams): Promise<InstanceRetrieveResponse> =>
      Promise.resolve({ items: [] })
  );
  const post = vi.fn((_path: string, _options?: CdfPostOptions) =>
    Promise.resolve({ data: { items: [] } })
  );

  return { project: 'test-project', instances: { list, retrieve }, post };
}

function readNodes(items: unknown[]): InstanceListResponse['items'] {
  const nodes: InstanceListResponse['items'] = [];
  for (const item of items) {
    if (isNode(item)) nodes.push(item);
  }
  return nodes;
}

function isNode(value: unknown): value is InstanceListResponse['items'][number] {
  return typeof value === 'object' && value !== null && 'instanceType' in value;
}
