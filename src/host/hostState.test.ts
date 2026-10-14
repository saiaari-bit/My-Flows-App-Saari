import { describe, expect, it } from 'vitest';

import type { AppState } from './hostState';
import {
  DEFAULT_APP_STATE,
  instanceRefEquals,
  isAppState,
  isInstanceRef,
  parseAppState,
  serializeAppState,
} from './hostState';

describe(parseAppState.name, () => {
  it('falls back to the search view when no host state was supplied', () => {
    expect(parseAppState(undefined)).toEqual(DEFAULT_APP_STATE);
    expect(parseAppState(null)).toEqual(DEFAULT_APP_STATE);
    expect(parseAppState('')).toEqual(DEFAULT_APP_STATE);
  });

  it('falls back to a safe default when the host state is not valid JSON', () => {
    expect(parseAppState('{not json')).toEqual(DEFAULT_APP_STATE);
  });

  it.each([
    ['a JSON primitive', '"search"'],
    ['a JSON array', '[{"view":"search"}]'],
    ['null', 'null'],
    ['an unknown view', '{"view":"dashboard"}'],
    ['a missing view', '{"asset":{"space":"s","externalId":"e"}}'],
    ['a non-string query', '{"view":"search","query":42}'],
    ['an asset without externalId', '{"view":"detail","asset":{"space":"s"}}'],
    ['an asset with an empty externalId', '{"view":"detail","asset":{"space":"s","externalId":""}}'],
    ['selectedTs that is not an array', '{"view":"search","selectedTs":{"space":"s","externalId":"e"}}'],
    ['selectedTs containing a malformed ref', '{"view":"search","selectedTs":[{"space":"s"}]}'],
    ['an unknown range preset', '{"view":"search","range":{"presetKey":"lastYear"}}'],
    ['a non-numeric range bound', '{"view":"search","range":{"end":"yesterday"}}'],
    ['a non-finite range bound', '{"view":"search","range":{"start":null}}'],
  ])('falls back to a safe default for %s', (_label, raw) => {
    expect(parseAppState(raw)).toEqual(DEFAULT_APP_STATE);
  });

  it('restores a deep-linked asset, time-series selection, and chart range', () => {
    const raw = JSON.stringify({
      view: 'detail',
      query: 'pump',
      asset: { space: 'my-space', externalId: 'PUMP-001' },
      selectedTs: [{ space: 'my-space', externalId: 'PUMP-001:pressure' }],
      range: { presetKey: 'last7d', start: 1000, end: 2000 },
    });

    expect(parseAppState(raw)).toEqual({
      view: 'detail',
      query: 'pump',
      asset: { space: 'my-space', externalId: 'PUMP-001' },
      selectedTs: [{ space: 'my-space', externalId: 'PUMP-001:pressure' }],
      range: { presetKey: 'last7d', start: 1000, end: 2000 },
    });
  });

  it('normalizes a detail route with no asset back to the search view', () => {
    expect(parseAppState('{"view":"detail","query":"pump"}')).toEqual({
      view: 'search',
      query: 'pump',
    });
  });

  it('accepts an empty time-series selection', () => {
    expect(parseAppState('{"view":"search","selectedTs":[]}')).toEqual({
      view: 'search',
      selectedTs: [],
    });
  });
});

describe(serializeAppState.name, () => {
  it('omits absent optional fields', () => {
    expect(serializeAppState({ view: 'search' })).toBe('{"view":"search"}');
  });

  it('round-trips through parseAppState', () => {
    const state: AppState = {
      view: 'detail',
      query: 'compressor',
      asset: { space: 'sp', externalId: 'C-1' },
      selectedTs: [{ space: 'sp', externalId: 'C-1:rpm' }],
      range: { presetKey: 'last24h', end: 1730000000000 },
    };

    expect(parseAppState(serializeAppState(state))).toEqual(state);
  });

  it('emits keys in a stable order regardless of input key order', () => {
    const a = serializeAppState({ view: 'detail', asset: { space: 's', externalId: 'e' }, query: 'q' });
    const b = serializeAppState({ query: 'q', asset: { space: 's', externalId: 'e' }, view: 'detail' });

    expect(a).toBe(b);
  });
});

describe(isInstanceRef.name, () => {
  it('accepts a well-formed reference', () => {
    expect(isInstanceRef({ space: 's', externalId: 'e' })).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a missing space', { externalId: 'e' }],
    ['an empty space', { space: '', externalId: 'e' }],
    ['a numeric externalId', { space: 's', externalId: 7 }],
  ])('rejects %s', (_label, value) => {
    expect(isInstanceRef(value)).toBe(false);
  });
});

describe(isAppState.name, () => {
  it('accepts the default state', () => {
    expect(isAppState(DEFAULT_APP_STATE)).toBe(true);
  });

  it('rejects a value that is not an object', () => {
    expect(isAppState('search')).toBe(false);
  });
});

describe(instanceRefEquals.name, () => {
  it('compares both space and externalId', () => {
    expect(instanceRefEquals({ space: 's', externalId: 'e' }, { space: 's', externalId: 'e' })).toBe(true);
    expect(instanceRefEquals({ space: 's', externalId: 'e' }, { space: 's', externalId: 'x' })).toBe(false);
    expect(instanceRefEquals({ space: 's', externalId: 'e' }, { space: 'x', externalId: 'e' })).toBe(false);
  });
});
