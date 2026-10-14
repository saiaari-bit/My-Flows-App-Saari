/**
 * Host-synced application state (SPEC FR-003, FR-004).
 *
 * The Fusion host serializes this object into the URL, so it is the deep-link
 * contract: everything a user expects to survive a reload or a shared link
 * lives here. Transient UI state (hover, debounce buffers, in-flight form
 * input) must stay in local React state instead.
 *
 * Because the value round-trips through a URL, it is untrusted on the way back
 * in and must be validated with the guards below rather than cast.
 */

export type InstanceRef = {
  space: string;
  externalId: string;
};

export const TIME_RANGE_PRESETS = ['last24h', 'last7d', 'last30d'] as const;

export type TimeRangePreset = (typeof TIME_RANGE_PRESETS)[number];

export type TimeRange = {
  presetKey?: TimeRangePreset;
  /** Epoch milliseconds. */
  start?: number;
  /** Epoch milliseconds. Anchored to the latest datapoint, never wall-clock now (SPEC FR-008). */
  end?: number;
};

export const APP_VIEWS = ['search', 'detail'] as const;

export type AppView = (typeof APP_VIEWS)[number];

export type AppState = {
  view: AppView;
  /** Search box text, host-synced so a shared search link reproduces the result list. */
  query?: string;
  /** The asset shown by the detail view (SPEC FR-003). */
  asset?: InstanceRef;
  /** Time series the user explicitly selected for plotting (SPEC FR-004, FR-007). */
  selectedTs?: InstanceRef[];
  /** Visible chart range (SPEC FR-004). */
  range?: TimeRange;
};

export const DEFAULT_APP_STATE: AppState = { view: 'search' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAppView(value: unknown): value is AppView {
  return typeof value === 'string' && APP_VIEWS.some((view) => view === value);
}

function isTimeRangePreset(value: unknown): value is TimeRangePreset {
  return typeof value === 'string' && TIME_RANGE_PRESETS.some((preset) => preset === value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isInstanceRef(value: unknown): value is InstanceRef {
  return (
    isRecord(value) &&
    typeof value.space === 'string' &&
    value.space.length > 0 &&
    typeof value.externalId === 'string' &&
    value.externalId.length > 0
  );
}

function isInstanceRefList(value: unknown): value is InstanceRef[] {
  return Array.isArray(value) && value.every(isInstanceRef);
}

function isTimeRange(value: unknown): value is TimeRange {
  if (!isRecord(value)) return false;
  if (value.presetKey !== undefined && !isTimeRangePreset(value.presetKey)) return false;
  if (value.start !== undefined && !isFiniteNumber(value.start)) return false;
  if (value.end !== undefined && !isFiniteNumber(value.end)) return false;
  return true;
}

/**
 * Narrows an unknown value to `AppState`. Unrecognized or malformed optional
 * fields cause the whole value to be rejected so callers always fall back to a
 * known-good default rather than rendering a half-restored screen.
 */
export function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) return false;
  if (!isAppView(value.view)) return false;
  if (value.query !== undefined && typeof value.query !== 'string') return false;
  if (value.asset !== undefined && !isInstanceRef(value.asset)) return false;
  if (value.selectedTs !== undefined && !isInstanceRefList(value.selectedTs)) return false;
  if (value.range !== undefined && !isTimeRange(value.range)) return false;
  return true;
}

/**
 * A `detail` view without an asset reference cannot render anything, so it is
 * normalized back to the search view instead of being treated as valid.
 */
function normalize(state: AppState): AppState {
  if (state.view === 'detail' && state.asset === undefined) {
    return { ...state, view: 'search' };
  }
  return state;
}

/**
 * Parses the `initialState` string handed over by the Fusion host.
 *
 * Returns `DEFAULT_APP_STATE` for anything unusable — absent state, invalid
 * JSON, or a shape that fails the guards — so a stale or hand-edited URL
 * degrades to the search view instead of crashing the app.
 */
export function parseAppState(raw: string | undefined | null): AppState {
  if (raw === undefined || raw === null || raw.length === 0) {
    return DEFAULT_APP_STATE;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return DEFAULT_APP_STATE;
  }

  if (!isAppState(decoded)) {
    return DEFAULT_APP_STATE;
  }

  return normalize(decoded);
}

/** Serializes state for `syncInternalState`. Keys are emitted in a stable order. */
export function serializeAppState(state: AppState): string {
  const ordered: AppState = { view: state.view };
  if (state.query !== undefined) ordered.query = state.query;
  if (state.asset !== undefined) ordered.asset = state.asset;
  if (state.selectedTs !== undefined) ordered.selectedTs = state.selectedTs;
  if (state.range !== undefined) ordered.range = state.range;
  return JSON.stringify(ordered);
}

export function instanceRefEquals(a: InstanceRef, b: InstanceRef): boolean {
  return a.space === b.space && a.externalId === b.externalId;
}
