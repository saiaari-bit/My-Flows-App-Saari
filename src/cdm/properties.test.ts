import { describe, expect, it } from 'vitest';

import { bareNode, cdmNode, TEST_SPACE } from '../__mocks__/cdmNodes';

import {
  instanceKey,
  instanceRefOf,
  propertyBag,
  readBoolean,
  readInstanceRef,
  readInstanceRefList,
  readNumber,
  readString,
  readStringList,
  readTimestamp,
  sameInstance,
  type PropertyBag,
} from './properties';
import { ASSET_VIEW, TIME_SERIES_VIEW } from './views';

describe(propertyBag.name, () => {
  it('reads the bag nested under the view space and versioned external id', () => {
    const node = cdmNode(ASSET_VIEW, 'asset-1', { name: 'Pump 1' });
    expect(propertyBag(node, ASSET_VIEW)).toEqual({ name: 'Pump 1' });
  });

  it('returns an empty bag when the node has no properties at all', () => {
    expect(propertyBag(bareNode('asset-1'), ASSET_VIEW)).toEqual({});
  });

  it('returns an empty bag when the node has data for a different view', () => {
    const node = cdmNode(TIME_SERIES_VIEW, 'ts-1', { name: 'Signal' });
    expect(propertyBag(node, ASSET_VIEW)).toEqual({});
  });
});

describe('scalar readers', () => {
  const bag: PropertyBag = {
    name: 'Pump 1',
    blank: '',
    count: 12,
    notFinite: Number.POSITIVE_INFINITY,
    isStep: false,
    wrongType: 42,
  };

  it('reads strings and rejects empty or wrongly typed values', () => {
    expect(readString(bag, 'name')).toBe('Pump 1');
    expect(readString(bag, 'blank')).toBeUndefined();
    expect(readString(bag, 'count')).toBeUndefined();
    expect(readString(bag, 'missing')).toBeUndefined();
  });

  it('reads finite numbers only', () => {
    expect(readNumber(bag, 'count')).toBe(12);
    expect(readNumber(bag, 'notFinite')).toBeUndefined();
    expect(readNumber(bag, 'name')).toBeUndefined();
  });

  it('reads booleans, keeping false distinct from missing', () => {
    expect(readBoolean(bag, 'isStep')).toBe(false);
    expect(readBoolean(bag, 'wrongType')).toBeUndefined();
    expect(readBoolean(bag, 'missing')).toBeUndefined();
  });
});

describe(readStringList.name, () => {
  it('reads a list of strings and drops entries of other types', () => {
    const bag: PropertyBag = { tags: ['a', 3, '', 'b', true] };
    expect(readStringList(bag, 'tags')).toEqual(['a', 'b']);
  });

  it('returns an empty list when the property is absent or not a list', () => {
    expect(readStringList({}, 'tags')).toEqual([]);
    expect(readStringList({ tags: 'a' }, 'tags')).toEqual([]);
  });
});

describe(readTimestamp.name, () => {
  it('accepts an epoch number', () => {
    expect(readTimestamp({ startTime: 1_700_000_000_000 }, 'startTime')).toBe(1_700_000_000_000);
  });

  it('accepts an ISO-8601 string', () => {
    expect(readTimestamp({ startTime: '2026-03-10T12:00:00.000Z' }, 'startTime')).toBe(
      Date.parse('2026-03-10T12:00:00.000Z')
    );
  });

  it('reports an unparseable or absent value as missing rather than NaN', () => {
    expect(readTimestamp({ startTime: 'not-a-date' }, 'startTime')).toBeUndefined();
    expect(readTimestamp({}, 'startTime')).toBeUndefined();
    expect(readTimestamp({ startTime: true }, 'startTime')).toBeUndefined();
  });
});

describe('direct relation readers', () => {
  it('reads a single direct relation', () => {
    const bag: PropertyBag = { parent: { space: 'sp', externalId: 'parent-1' } };
    expect(readInstanceRef(bag, 'parent')).toEqual({ space: 'sp', externalId: 'parent-1' });
  });

  it('rejects values that are not instance references', () => {
    expect(readInstanceRef({ parent: { space: 'sp' } }, 'parent')).toBeUndefined();
    expect(readInstanceRef({ parent: 'sp:parent-1' }, 'parent')).toBeUndefined();
    expect(readInstanceRef({ parent: [{ space: 'sp', externalId: 'p' }] }, 'parent')).toBeUndefined();
    expect(readInstanceRef({}, 'parent')).toBeUndefined();
  });

  it('reads a list of direct relations and skips malformed entries', () => {
    const bag: PropertyBag = {
      assets: [{ space: 'sp', externalId: 'a1' }, { externalId: 'a2' }, { space: 'sp', externalId: 'a3' }],
    };
    expect(readInstanceRefList(bag, 'assets')).toEqual([
      { space: 'sp', externalId: 'a1' },
      { space: 'sp', externalId: 'a3' },
    ]);
  });

  it('returns an empty list when the property is absent or not a list', () => {
    expect(readInstanceRefList({}, 'assets')).toEqual([]);
    expect(readInstanceRefList({ assets: { space: 'sp', externalId: 'a1' } }, 'assets')).toEqual([]);
  });
});

describe('instance identity helpers', () => {
  it('derives an instance reference from a node', () => {
    expect(instanceRefOf(bareNode('asset-1'))).toEqual({ space: TEST_SPACE, externalId: 'asset-1' });
  });

  it('builds a key that separates space from external id', () => {
    expect(instanceKey({ space: 'sp', externalId: 'a1' })).toBe('sp:a1');
  });

  it('compares instances, treating null as only equal to null', () => {
    const ref = { space: 'sp', externalId: 'a1' };
    expect(sameInstance(ref, { ...ref })).toBe(true);
    expect(sameInstance(ref, { space: 'other', externalId: 'a1' })).toBe(false);
    expect(sameInstance(null, null)).toBe(true);
    expect(sameInstance(ref, null)).toBe(false);
  });
});
