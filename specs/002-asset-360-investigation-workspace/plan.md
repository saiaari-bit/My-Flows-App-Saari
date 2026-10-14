# Asset 360 Investigation Workspace — Implementation plan

Companion to `spec.md`. The running app follows the feature layout below, matching
`cognitedata/charan-asset-360` `main`. The earlier `views/` + `hooks/` + `cdm/` layering
described further down in this file is no longer the implementation.

```
src/features/search/          Search view, debounced query, result list
src/features/asset-detail/    Header, time series, activities, documents
src/features/recently-viewed/ Per-project localStorage list, cap 10
src/router/                   Host-synced search/detail route
src/services/                 CDF reads for asset, time series, activity, file
src/cognite-file-viewer/      Inline PDF and image preview
src/errors/                   App-level error boundary
src/host/                     Host API context and state guards
```

## 1. Architecture

Four layers, each depending only on the one below it:

```
views/        Aura components. Render props. No CDF calls, no fetching.
hooks/        View models. Compose state + service. Stateless themselves.
state/        The one shared store for UI state. Host-synced.
services/     All CDF access. The only layer that knows about CogniteClient.
cdm/          Verified view references + safe readers for raw DMS property bags.
domain/       Pure types, formatting, derivations. No I/O.
```

`src/` layout:

| Path | Responsibility |
| --- | --- |
| `cdm/views.ts` | The five `ViewReference` constants and the `[space, 'ExternalId/version', prop]` reference builder |
| `cdm/properties.ts` | Type guards turning `RawPropertyValueV3` into `string`/`number`/`boolean`/`string[]`/instance ids |
| `cdm/mappers.ts` | `NodeDefinition` → domain model, one mapper per view |
| `domain/asset360Types.ts` | `AssetRef`, `AssetSummary`, `SignalSummary`, `WorkOrder`, `DocumentFile` |
| `domain/workOrderStatus.ts` | Derives Completed / In progress / Planned / Unknown from schedule fields |
| `domain/timeWindow.ts` | Window preset → `{ start, end, granularity }` |
| `domain/format.ts` | Timestamps, numbers, byte-free MIME labels, relative times |
| `domain/rankAssetMatches.ts` | The deterministic search re-rank of FR-4 |
| `services/asset360Service.ts` | `Asset360Service` interface + the narrow slice of `CogniteClient` it needs |
| `services/CdfAsset360Service.ts` | Implementation. Query construction lives here and nowhere else |
| `state/asset360StateContext.ts` | Storage contract + UI state type + parser for host state |
| `state/Asset360StateProvider.tsx` | Single state holder near the root; seeds from `initialState`, pushes `syncInternalState` |
| `state/asset360ViewModelContext.tsx` | DI context supplying the service and storage hook to view models |
| `hooks/useAssetSearchViewModel.ts` | Debounced query → search → ranked results |
| `hooks/useAsset360ViewModel.ts` | Selected asset → summary + the three panel queries |
| `views/*` | Workspace shell, search control, summary card, three panels, shared state renderers |

### Why this shape

- `CogniteClient` is injected as a narrow interface, so services are unit-testable with plain
  objects and no `vi.mock`.
- View models hold no `useState`. UI state lives in `Asset360StateProvider`; server state lives
  in the React Query cache. Both are shared stores, so two components calling the same view
  model observe the same values.
- Query construction is centralised in `CdfAsset360Service`, so a schema change is a one-file
  change and the verified filter shapes are reviewable in one place.

## 2. Data access

| Concern | Decision |
| --- | --- |
| Asset search | `instances.search` on `CogniteAsset/v1`, `properties: ['name','description','aliases']`, `limit: 25` |
| Asset detail | `instances.retrieve` with `sources: [CogniteAsset/v1]` |
| Related children | `instances.list` with `containsAny` on the child's `assets` property — the documented reverse lookup for list-valued reverse direct relations |
| Ordering | Activities sorted `startTime` desc, files `uploadedTime` desc, both `nullsFirst: false` so unscheduled/unuploaded rows sink |
| Latest reading | one batched `datapoints.retrieveLatest` for all related series, `ignoreUnknownIds: true` |
| Chart | one batched `datapoints.retrieve` with `aggregates: ['average']` for numeric series only |
| Units | batched `instances.retrieve` of the `CogniteUnit` nodes referenced by `unit`, only for series lacking `sourceUnit` |
| Document open | `files.getDownloadUrls([{ instanceId }])` → `HostAppAPI.navigateExternal({ url, openInNewTab: true })` |

Partial failure: `getSignals` returns the series list even when the datapoints or unit calls
fail, recording a `warnings` array. Losing latest values must not lose the signal list.

## 3. State and staleness

Host-synced (`syncInternalState`, per the repo's host-integration rule): `selected` asset ref,
`tab`, `window`, and the committed search `query`.

Staleness is handled by React Query keys rather than hand-rolled cancellation. Every dependent
query key contains the selected asset's `space` and `externalId`:

```
['asset360', 'signals', space, externalId]
['asset360', 'chart', space, externalId, window, ...signalIds]
['asset360', 'workOrders', space, externalId]
['asset360', 'documents', space, externalId]
```

Changing the selection changes the key, so an in-flight response for the old asset resolves
into the old cache entry and can never render in the new asset's panel. Each panel is a
separate query, which is also what makes partial failure work.

## 4. Search behaviour

Local input state lives in the search component (in-flight typing is explicitly local-only).
A 300 ms debounce promotes it to the committed query, which is what gets synced to the host and
used as the query key. Empty/whitespace short-circuits to idle with no request.

Ranking: CDF relevance order is preserved inside four deterministic bands — exact
name/alias match, name prefix match, name substring match, everything else.

## 5. Loading, empty, and error handling

One shared `PanelState` component renders loading / empty / error so all three panels behave
identically. Errors are caught at the service boundary, logged with `console.error`, and
re-thrown as an `Asset360Error` carrying a plain-language message plus the original cause; the
UI only ever renders the plain-language message and a Retry button wired to React Query's
`refetch`.

## 6. UI composition

`Asset360Workspace` is the only component that calls `useAsset360ViewModel` for the shell;
panels call it too, which is safe because it is backed by shared context and the query cache.

Accessibility work items: `aria-label` on both data grids and the chart, `aria-busy` on loading
regions, a text summary of the chart's range next to the chart, status as text + `Badge`
variant, and a keyboard-reachable open action per document row.

## 7. Testing

Behaviour first, then units:

1. `views/Asset360Workspace.test.tsx` — search → select → panels populate; empty; error;
   switching assets.
2. `hooks/*.test.tsx` — loading/success/error for each view model.
3. `services/CdfAsset360Service.test.ts` — exact request bodies for each query (this is what
   guards the verified schema), response parsing, and error on failure.
4. `cdm/*.test.ts`, `domain/*.test.ts` — every exported function and branch.

Dependencies are injected through context or constructor arguments; no `vi.mock` of CDF.

## 8. Order of work

1. `cdm/` + `domain/` with tests (pure, no dependencies).
2. `services/` with request-shape tests.
3. `state/` + `hooks/` with tests.
4. `views/` with the integration test.
5. Delete the replaced workflow-ops feature, retarget `app.json`.
6. `tsc` → `eslint` → `vitest` → `vite build`, then self-review.
