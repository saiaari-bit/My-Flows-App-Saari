import { describe, expect, it } from 'vitest';

import type { SearchState } from './searchState';
import { IDLE_SEARCH_STATE, rankAssets, searchReducer } from './searchState';

import { makeAsset } from '@/__mocks__/assetService';

describe(searchReducer.name, () => {
  it('moves to a loading state for the query being searched', () => {
    const next = searchReducer(IDLE_SEARCH_STATE, { type: 'searchStarted', query: 'pump' });

    expect(next).toEqual({ query: 'pump', status: 'loading', results: [] });
  });

  it('stores the results of the query in flight', () => {
    const loading = searchReducer(IDLE_SEARCH_STATE, { type: 'searchStarted', query: 'pump' });

    const next = searchReducer(loading, {
      type: 'searchSucceeded',
      query: 'pump',
      results: [makeAsset('PUMP-002')],
    });

    expect(next).toMatchObject({ query: 'pump', status: 'ready' });
    expect(next.results.map((asset) => asset.externalId)).toEqual(['PUMP-002']);
  });

  it('drops results that answer a query the user has already typed past', () => {
    const loading = searchReducer(IDLE_SEARCH_STATE, { type: 'searchStarted', query: 'pump' });

    const next = searchReducer(loading, {
      type: 'searchSucceeded',
      query: 'pu',
      results: [makeAsset('PUMP-002')],
    });

    expect(next).toBe(loading);
  });

  it('records the error kind for the query in flight', () => {
    const loading = searchReducer(IDLE_SEARCH_STATE, { type: 'searchStarted', query: 'pump' });

    const next = searchReducer(loading, { type: 'searchFailed', query: 'pump', kind: 'no-access' });

    expect(next).toEqual({ query: 'pump', status: 'error', results: [], errorKind: 'no-access' });
  });

  it('drops a failure that answers a superseded query', () => {
    const loading = searchReducer(IDLE_SEARCH_STATE, { type: 'searchStarted', query: 'pump' });

    const next = searchReducer(loading, { type: 'searchFailed', query: 'pu', kind: 'transient' });

    expect(next).toBe(loading);
  });

  it('clears a previous error when a new search starts', () => {
    const failed: SearchState = {
      query: 'pump',
      status: 'error',
      results: [],
      errorKind: 'transient',
    };

    const next = searchReducer(failed, { type: 'searchStarted', query: 'valve' });

    expect(next.errorKind).toBeUndefined();
  });

  it('returns to the initial state when the query is cleared', () => {
    const ready = searchReducer(
      searchReducer(IDLE_SEARCH_STATE, { type: 'searchStarted', query: 'pump' }),
      { type: 'searchSucceeded', query: 'pump', results: [makeAsset('PUMP-002')] }
    );

    expect(searchReducer(ready, { type: 'searchCleared' })).toEqual(IDLE_SEARCH_STATE);
  });

  it('keeps the same state object when clearing an already idle search', () => {
    expect(searchReducer(IDLE_SEARCH_STATE, { type: 'searchCleared' })).toBe(IDLE_SEARCH_STATE);
  });
});

describe(rankAssets.name, () => {
  it('puts an exact tag match first', () => {
    const ranked = rankAssets('pump-001', [
      makeAsset('PUMP-0012', { name: 'Pump 12' }),
      makeAsset('VALVE-9', { description: 'Downstream of PUMP-001' }),
      makeAsset('PUMP-001', { name: 'Feed water pump' }),
    ]);

    expect(ranked.map((asset) => asset.externalId)).toEqual(['PUMP-001', 'PUMP-0012', 'VALVE-9']);
  });

  it('ranks a tag prefix above a name or description match', () => {
    const ranked = rankAssets('pump', [
      makeAsset('VALVE-9', { name: 'Pump bypass valve' }),
      makeAsset('PUMP-002', { name: 'Second pump' }),
    ]);

    expect(ranked.map((asset) => asset.externalId)).toEqual(['PUMP-002', 'VALVE-9']);
  });

  it('ranks an exact name match above a description match', () => {
    const ranked = rankAssets('feed water pump', [
      makeAsset('VALVE-9', { description: 'Feed water pump bypass' }),
      makeAsset('PUMP-001', { name: 'Feed water pump' }),
    ]);

    expect(ranked.map((asset) => asset.externalId)).toEqual(['PUMP-001', 'VALVE-9']);
  });

  it('preserves the order CDF returned inside a tier', () => {
    const ranked = rankAssets('pump', [
      makeAsset('PUMP-003'),
      makeAsset('PUMP-001'),
      makeAsset('PUMP-002'),
    ]);

    expect(ranked.map((asset) => asset.externalId)).toEqual(['PUMP-003', 'PUMP-001', 'PUMP-002']);
  });

  it('returns the results unchanged for a blank query', () => {
    const assets = [makeAsset('B'), makeAsset('A')];

    expect(rankAssets('   ', assets).map((asset) => asset.externalId)).toEqual(['B', 'A']);
  });
});
