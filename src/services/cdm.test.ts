import { describe, expect, it, vi } from 'vitest';

import type { InstanceListParams, InstanceListResponse, InstanceNode, ViewPropertyValues } from './cdm';
import {
  CDM_SPACE,
  cdmPropertyRef,
  cdmView,
  dedupeByInstanceId,
  instanceIdKey,
  linkedToAssetFilter,
  listAllInstances,
  readBoolean,
  readInstance,
  readItems,
  readString,
  readTimestamp,
} from './cdm';

describe(cdmView.name, () => {
  it('builds a fully qualified v1 view reference in the core data model space', () => {
    expect(cdmView('CogniteAsset')).toEqual({
      type: 'view',
      space: 'cdf_cdm',
      externalId: 'CogniteAsset',
      version: 'v1',
    });
  });
});

describe(cdmPropertyRef.name, () => {
  it('versions the view in the property reference, which silently matches nothing otherwise', () => {
    expect(cdmPropertyRef('CogniteTimeSeries', 'assets')).toEqual([
      'cdf_cdm',
      'CogniteTimeSeries/v1',
      'assets',
    ]);
  });
});

describe(linkedToAssetFilter.name, () => {
  it('filters the owning view on its versioned assets list, using the asset instance id', () => {
    expect(linkedToAssetFilter('CogniteFile', { space: 'sp', externalId: 'PUMP-1' })).toEqual({
      containsAny: {
        property: ['cdf_cdm', 'CogniteFile/v1', 'assets'],
        values: [{ space: 'sp', externalId: 'PUMP-1' }],
      },
    });
  });
});

describe(readInstance.name, () => {
  it('reduces a node to its identity plus the requested view property bag', () => {
    const node = buildNode({ externalId: 'PUMP-1', view: 'CogniteAsset', properties: { name: 'Pump 21' } });

    expect(readInstance(node, 'CogniteAsset')).toEqual({
      id: { space: 'sp', externalId: 'PUMP-1' },
      properties: { name: 'Pump 21' },
      lastUpdatedTime: 0,
    });
  });

  it('returns an empty property bag when the node carries no data for that view', () => {
    const node = buildNode({ externalId: 'PUMP-1', view: 'CogniteAsset', properties: { name: 'Pump' } });

    expect(readInstance(node, 'CogniteTimeSeries')?.properties).toEqual({});
  });

  it.each([
    ['a non-object', 'PUMP-1'],
    ['null', null],
    ['a missing space', { externalId: 'PUMP-1' }],
    ['an empty external id', { space: 'sp', externalId: '' }],
    ['a numeric external id', { space: 'sp', externalId: 7 }],
  ])('rejects %s rather than inventing an identity', (_label, value) => {
    expect(readInstance(value, 'CogniteAsset')).toBeUndefined();
  });
});

describe(readItems.name, () => {
  it('pulls the items array out of a raw response body', () => {
    expect(readItems({ items: [1, 2] })).toEqual([1, 2]);
  });

  it.each([
    ['a body without items', {}],
    ['a non-array items field', { items: 'nope' }],
    ['a non-object body', null],
  ])('returns an empty list for %s', (_label, body) => {
    expect(readItems(body)).toEqual([]);
  });
});

describe(readString.name, () => {
  it('returns the value for a string property', () => {
    expect(readString({ name: 'Pump 21' }, 'name')).toBe('Pump 21');
  });

  it.each([
    ['a missing key', {}],
    ['a numeric value', { name: 42 }],
    ['a null value', { name: null }],
    ['an object value', { name: { space: 'sp' } }],
  ])('returns undefined for %s', (_label, properties: Record<string, unknown>) => {
    expect(readString(properties, 'name')).toBeUndefined();
  });
});

describe(readBoolean.name, () => {
  it('returns the value for a boolean property', () => {
    expect(readBoolean({ isUploaded: false }, 'isUploaded')).toBe(false);
  });

  it('returns undefined for a non-boolean value', () => {
    expect(readBoolean({ isUploaded: 'true' }, 'isUploaded')).toBeUndefined();
  });
});

describe(readTimestamp.name, () => {
  it('passes through an epoch-millisecond number', () => {
    expect(readTimestamp({ startTime: 1730000000000 }, 'startTime')).toBe(1730000000000);
  });

  it('parses an ISO-8601 string, since the wire format of DMS timestamps is not pinned by the docs', () => {
    expect(readTimestamp({ startTime: '2024-01-02T03:04:05.000Z' }, 'startTime')).toBe(
      Date.parse('2024-01-02T03:04:05.000Z')
    );
  });

  it.each([
    ['a missing key', {}],
    ['an unparseable string', { startTime: 'yesterday' }],
    ['a boolean', { startTime: true }],
  ])('returns undefined for %s', (_label, properties: Record<string, unknown>) => {
    expect(readTimestamp(properties, 'startTime')).toBeUndefined();
  });
});

describe(instanceIdKey.name, () => {
  it('does not collide when a space or external id contains the separator character', () => {
    const a = instanceIdKey({ space: 'a', externalId: 'b:c' });
    const b = instanceIdKey({ space: 'a:b', externalId: 'c' });

    expect(a).not.toBe(b);
  });
});

describe(dedupeByInstanceId.name, () => {
  it('keeps the first occurrence of each instance id and preserves order', () => {
    const items = [
      { space: 'sp', externalId: 'a', label: 'first' },
      { space: 'sp', externalId: 'b', label: 'second' },
      { space: 'sp', externalId: 'a', label: 'duplicate' },
      { space: 'other', externalId: 'a', label: 'different space' },
    ];

    expect(dedupeByInstanceId(items)).toEqual([
      { space: 'sp', externalId: 'a', label: 'first' },
      { space: 'sp', externalId: 'b', label: 'second' },
      { space: 'other', externalId: 'a', label: 'different space' },
    ]);
  });
});

describe(listAllInstances.name, () => {
  it('follows the cursor until the API stops returning one', async () => {
    // Arrange
    const list = buildListMock([
      { items: [buildNode({ externalId: 'a', view: 'CogniteFile', properties: {} })], nextCursor: 'page-2' },
      { items: [buildNode({ externalId: 'b', view: 'CogniteFile', properties: {} })] },
    ]);

    // Act
    const instances = await listAllInstances({ instances: { list } }, baseParams(), 'CogniteFile');

    // Assert
    expect(instances.map((instance) => instance.id.externalId)).toEqual(['a', 'b']);
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[0]?.[0].cursor).toBeUndefined();
    expect(list.mock.calls[1]?.[0].cursor).toBe('page-2');
  });

  it('stops when a page comes back empty, even if the API keeps handing out a cursor', async () => {
    const list = buildListMock([
      { items: [], nextCursor: 'page-2' },
      { items: [], nextCursor: 'page-3' },
    ]);

    const instances = await listAllInstances({ instances: { list } }, baseParams(), 'CogniteFile');

    expect(instances).toEqual([]);
    expect(list).toHaveBeenCalledTimes(1);
  });
});

function baseParams(): InstanceListParams {
  return {
    instanceType: 'node',
    sources: [{ source: cdmView('CogniteFile') }],
    limit: 1000,
  };
}

function buildListMock(pages: InstanceListResponse[]) {
  const remaining = [...pages];
  return vi.fn(
    async (_params: InstanceListParams): Promise<InstanceListResponse> => remaining.shift() ?? { items: [] }
  );
}

function buildNode(options: {
  externalId: string;
  view: string;
  properties: ViewPropertyValues;
}): InstanceNode {
  return {
    instanceType: 'node',
    space: 'sp',
    externalId: options.externalId,
    version: 1,
    createdTime: 0,
    lastUpdatedTime: 0,
    properties: { [CDM_SPACE]: { [`${options.view}/v1`]: options.properties } },
  };
}
