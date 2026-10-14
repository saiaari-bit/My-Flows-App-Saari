import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_UI_STATE,
  parseWorkspaceUiState,
  serializeWorkspaceUiState,
  type WorkspaceUiState,
} from './workspaceUiState';

describe(parseWorkspaceUiState.name, () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('falls back to defaults when the host has no state for this load', () => {
    expect(parseWorkspaceUiState(undefined)).toEqual(DEFAULT_UI_STATE);
    expect(parseWorkspaceUiState('')).toEqual(DEFAULT_UI_STATE);
  });

  it('restores a full investigation from the host state', () => {
    const state: WorkspaceUiState = {
      selected: { space: 'sp', externalId: '23-HA-9114' },
      tab: 'documents',
      window: '30d',
      query: '23-HA',
    };

    expect(parseWorkspaceUiState(JSON.stringify(state))).toEqual(state);
  });

  it('still opens the app when the host state is not valid JSON', () => {
    expect(parseWorkspaceUiState('{not json')).toEqual(DEFAULT_UI_STATE);
  });

  it('ignores a tab or window that this version no longer has', () => {
    const parsed = parseWorkspaceUiState(JSON.stringify({ tab: 'threeD', window: '1y' }));

    expect(parsed.tab).toBe(DEFAULT_UI_STATE.tab);
    expect(parsed.window).toBe(DEFAULT_UI_STATE.window);
  });

  it('rejects a selection that is not a complete instance reference', () => {
    expect(parseWorkspaceUiState(JSON.stringify({ selected: { space: 'sp' } })).selected).toBeNull();
    expect(parseWorkspaceUiState(JSON.stringify({ selected: 'sp:asset' })).selected).toBeNull();
    expect(
      parseWorkspaceUiState(JSON.stringify({ selected: { space: '', externalId: 'a' } })).selected
    ).toBeNull();
  });

  it('ignores a non-object payload', () => {
    expect(parseWorkspaceUiState('42')).toEqual(DEFAULT_UI_STATE);
    expect(parseWorkspaceUiState('[1,2]')).toEqual(DEFAULT_UI_STATE);
  });

  it('round-trips through serialization', () => {
    const state: WorkspaceUiState = {
      selected: { space: 'sp', externalId: 'a1' },
      tab: 'workOrders',
      window: '7d',
      query: 'pump',
    };

    expect(parseWorkspaceUiState(serializeWorkspaceUiState(state))).toEqual(state);
  });
});
