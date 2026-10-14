import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PUMP_REF } from '../__mocks__/asset360Fixtures';
import { renderWorkspaceHook } from '../__mocks__/renderWorkspace';

import { useWorkspaceStorage } from './workspaceStorageContext';

describe('Asset360StateProvider', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('seeds its state from the host initialState', () => {
    const { result } = renderWorkspaceHook(useWorkspaceStorage, {
      initialState: JSON.stringify({ selected: PUMP_REF, tab: 'documents', window: '7d', query: '23-HA' }),
    });

    expect(result.current.selected).toEqual(PUMP_REF);
    expect(result.current.tab).toBe('documents');
    expect(result.current.window).toBe('7d');
    expect(result.current.query).toBe('23-HA');
  });

  it('pushes the whole state to the host whenever the selection changes', () => {
    const { result, harness } = renderWorkspaceHook(useWorkspaceStorage);

    act(() => result.current.selectAsset(PUMP_REF));

    expect(harness.hostApi.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ selected: PUMP_REF, tab: 'signals', window: '24h', query: '' })
    );
  });

  it('opens a newly selected asset on its signals, whatever tab was open before', () => {
    const { result } = renderWorkspaceHook(useWorkspaceStorage, {
      initialState: JSON.stringify({ tab: 'documents' }),
    });

    act(() => result.current.selectAsset(PUMP_REF));

    expect(result.current.tab).toBe('signals');
  });

  it('syncs tab, window, and query changes', () => {
    const { result, harness } = renderWorkspaceHook(useWorkspaceStorage);

    act(() => result.current.setTab('workOrders'));
    act(() => result.current.setWindow('30d'));
    act(() => result.current.setQuery('pump'));

    expect(result.current.tab).toBe('workOrders');
    expect(result.current.window).toBe('30d');
    expect(result.current.query).toBe('pump');
    expect(harness.hostApi.syncInternalState).toHaveBeenCalledTimes(3);
  });

  it('keeps working when no Fusion host is connected', () => {
    const { result } = renderWorkspaceHook(useWorkspaceStorage, { withoutHost: true });

    act(() => result.current.selectAsset(PUMP_REF));

    expect(result.current.selected).toEqual(PUMP_REF);
  });

  it('keeps the selection when the host rejects the sync', async () => {
    const { result, harness } = renderWorkspaceHook(useWorkspaceStorage);
    harness.hostApi.syncInternalState.mockRejectedValue(new Error('host gone'));

    await act(async () => {
      result.current.selectAsset(PUMP_REF);
    });

    expect(result.current.selected).toEqual(PUMP_REF);
  });
});
