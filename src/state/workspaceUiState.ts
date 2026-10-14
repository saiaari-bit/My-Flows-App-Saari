import type { InstanceRef, TimeWindowId, WorkspaceTab } from '../domain/asset360Types';
import { TIME_WINDOWS, WORKSPACE_TABS } from '../domain/asset360Types';

/**
 * The UI state the Fusion host persists into the URL, so a reload or a shared
 * link reopens the same investigation. Everything here drives what is on
 * screen; in-flight typing is deliberately not part of it.
 */
export type WorkspaceUiState = {
  selected: InstanceRef | null;
  tab: WorkspaceTab;
  window: TimeWindowId;
  /** The committed (debounced) search query, not each keystroke. */
  query: string;
};

export const DEFAULT_UI_STATE: WorkspaceUiState = {
  selected: null,
  tab: 'signals',
  window: '24h',
  query: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSelected(value: unknown): InstanceRef | null {
  if (!isRecord(value)) {
    return null;
  }
  const { space, externalId } = value;
  if (typeof space !== 'string' || typeof externalId !== 'string') {
    return null;
  }
  return space.length > 0 && externalId.length > 0 ? { space, externalId } : null;
}

function parseMember<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/**
 * Rebuilds state from the host's `initialState` string. Anything unrecognised
 * falls back to the default, so a stale or hand-edited URL still opens the app.
 */
export function parseWorkspaceUiState(raw: string | undefined): WorkspaceUiState {
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_UI_STATE;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    console.error('Asset 360: ignoring unreadable host state', cause);
    return DEFAULT_UI_STATE;
  }

  if (!isRecord(parsed)) {
    return DEFAULT_UI_STATE;
  }

  return {
    selected: parseSelected(parsed.selected),
    tab: parseMember(parsed.tab, WORKSPACE_TABS, DEFAULT_UI_STATE.tab),
    window: parseMember(parsed.window, TIME_WINDOWS, DEFAULT_UI_STATE.window),
    query: typeof parsed.query === 'string' ? parsed.query : DEFAULT_UI_STATE.query,
  };
}

export function serializeWorkspaceUiState(state: WorkspaceUiState): string {
  return JSON.stringify(state);
}
