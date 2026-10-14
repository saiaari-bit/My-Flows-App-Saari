import { describe, expect, it } from 'vitest';

import { routeReducer } from './routeState';

import type { AppState } from '@/host/hostState';


const ASSET = { space: 'my-space', externalId: 'PUMP-001' };
const OTHER_ASSET = { space: 'my-space', externalId: 'PUMP-002' };
const PRESSURE = { space: 'my-space', externalId: 'PUMP-001:pressure' };
const FLOW = { space: 'my-space', externalId: 'PUMP-001:flow' };

describe(routeReducer.name, () => {
  it('switches to the search view while keeping the asset for a return trip', () => {
    const state: AppState = { view: 'detail', asset: ASSET };

    expect(routeReducer(state, { type: 'openSearch' })).toEqual({ view: 'search', asset: ASSET });
  });

  it('records the search query', () => {
    expect(routeReducer({ view: 'search' }, { type: 'setQuery', query: 'pump' })).toEqual({
      view: 'search',
      query: 'pump',
    });
  });

  it('opens an asset into the detail view', () => {
    expect(routeReducer({ view: 'search' }, { type: 'openAsset', asset: ASSET })).toEqual({
      view: 'detail',
      asset: ASSET,
    });
  });

  it('preserves the search query when opening an asset so returning to search keeps context', () => {
    const state: AppState = { view: 'search', query: 'pump' };

    expect(routeReducer(state, { type: 'openAsset', asset: ASSET })).toEqual({
      view: 'detail',
      query: 'pump',
      asset: ASSET,
    });
  });

  it('clears the previous asset time-series selection and range when opening a different asset', () => {
    const state: AppState = {
      view: 'detail',
      asset: ASSET,
      selectedTs: [PRESSURE],
      range: { presetKey: 'last7d' },
    };

    expect(routeReducer(state, { type: 'openAsset', asset: OTHER_ASSET })).toEqual({
      view: 'detail',
      asset: OTHER_ASSET,
    });
  });

  it('keeps the selection and range when re-opening the asset already in view', () => {
    const state: AppState = {
      view: 'search',
      asset: ASSET,
      selectedTs: [PRESSURE],
      range: { presetKey: 'last7d' },
    };

    expect(routeReducer(state, { type: 'openAsset', asset: ASSET })).toEqual({
      view: 'detail',
      asset: ASSET,
      selectedTs: [PRESSURE],
      range: { presetKey: 'last7d' },
    });
  });

  it('replaces the whole time-series selection', () => {
    const state: AppState = { view: 'detail', asset: ASSET, selectedTs: [PRESSURE] };

    expect(routeReducer(state, { type: 'setSelectedTimeSeries', selectedTs: [FLOW] }).selectedTs).toEqual([
      FLOW,
    ]);
  });

  it('adds an unselected time series when toggled', () => {
    const state: AppState = { view: 'detail', asset: ASSET, selectedTs: [PRESSURE] };

    expect(routeReducer(state, { type: 'toggleTimeSeries', timeSeries: FLOW }).selectedTs).toEqual([
      PRESSURE,
      FLOW,
    ]);
  });

  it('removes an already selected time series when toggled', () => {
    const state: AppState = { view: 'detail', asset: ASSET, selectedTs: [PRESSURE, FLOW] };

    expect(routeReducer(state, { type: 'toggleTimeSeries', timeSeries: PRESSURE }).selectedTs).toEqual([
      FLOW,
    ]);
  });

  it('starts a selection from an empty state when toggling with nothing selected', () => {
    const state: AppState = { view: 'detail', asset: ASSET };

    expect(routeReducer(state, { type: 'toggleTimeSeries', timeSeries: PRESSURE }).selectedTs).toEqual([
      PRESSURE,
    ]);
  });

  it('records the chart time range', () => {
    const state: AppState = { view: 'detail', asset: ASSET };
    const range = { presetKey: 'last24h', end: 1730000000000 } as const;

    expect(routeReducer(state, { type: 'setTimeRange', range }).range).toEqual(range);
  });

  it('does not mutate the state it was given', () => {
    const state: AppState = { view: 'detail', asset: ASSET, selectedTs: [PRESSURE] };
    const snapshot = structuredClone(state);

    routeReducer(state, { type: 'toggleTimeSeries', timeSeries: FLOW });

    expect(state).toEqual(snapshot);
  });
});
