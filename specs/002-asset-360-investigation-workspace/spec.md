# Asset 360 Investigation Workspace — Specification

**Status**: Implemented (v0.1.0)
**Target environment**: org `publicdata`, project `publicdatacdm`, base URL `https://api.cognitedata.com`
**Data model space**: `cdf_cdm` (Cognite Core Data Model, all views at `v1`)

This document supersedes `specs/001-workflow-ops/spec.md`. That feature (a workflow cost
console) has been removed from this repository; the app has been repurposed to the Asset 360
Investigation Workspace described below.

---

## 1. Product purpose

Give an industrial operations analyst a single screen that answers "what is going on with this
piece of equipment?" by pulling the asset's process signals, work orders, and documents out of
CDF and onto one page, in the order an investigation actually happens.

The app deliberately does **not** teach the user the data model. The user searches a tag and
reads three panels. Words like "view", "instance", "direct relation", and "space" never appear
in the primary UI.

## 2. Target user

**Operations Analyst / Reliability Engineer** at an industrial facility.

- Triggered into the app by an anomaly, alarm, or operational complaint.
- Knows equipment by its **tag** (for example `23-HA-9114`), not by CDF identifiers.
- Is time-pressured: the first 30 seconds of the session decide whether the app is useful.
- Is not a CDF developer and will not debug a query.

## 3. User problem

Understanding one asset today means visiting several systems:

| Question | System visited today |
| --- | --- |
| What are the process values doing? | Historian / time-series tool |
| What work has been done or is planned? | SAP / work-order system |
| What is the P&ID or datasheet? | SharePoint / document repository |

Each hop loses context and costs minutes. Nothing correlates the three. The analyst ends up
reconstructing the same picture by hand on every investigation.

## 4. User journey

1. The analyst opens the app in Fusion. The workspace explains, in one line, what to do, and
   focus is available on the asset search control.
2. They type part of a tag. After a short debounce the app searches `CogniteAsset` and shows
   ranked matches with name and description.
3. They pick a result. The app records the selection in host-synced state so a reload or a
   shared link reopens the same investigation.
4. The asset summary renders immediately from the search result and is then upgraded with the
   full asset record (description, tags, hierarchy parent/root, source system id).
5. Three panels load **independently and in parallel**:
   - **Time series** — related signals, each with its latest reading and unit, plus a chart of
     the selected signals over the chosen window.
   - **Work orders** — related activities, most recent first, with status derived from the
     schedule fields.
   - **Documents** — related files, with type and upload state, and an open action.
6. The analyst changes the time window (24 hours / 7 days / 30 days) and the chart requeries.
7. The analyst opens a document. The app requests a short-lived CDF download URL and hands it
   to the Fusion host to open in a new tab.
8. The analyst searches a different tag. Every panel resets and refetches for the new asset;
   no response from the previous asset can land in the new asset's panels.

## 5. Functional requirements

### Search

- **FR-1** The app MUST search assets server-side via the Data Modeling search endpoint against
  `cdf_cdm:CogniteAsset/v1`, restricted to the text properties `name`, `description`, `aliases`.
- **FR-2** Search MUST be debounced (300 ms) and MUST NOT issue a request for an empty or
  whitespace-only query.
- **FR-3** The app MUST NOT list the whole asset population. Search is capped at 25 results.
- **FR-4** Results MUST be re-ranked deterministically client-side so that an exact tag match
  sorts first, then a prefix match on name, then a match anywhere in name, then everything else,
  preserving CDF relevance order inside each band. The app MUST NOT claim fuzzy matching, which
  it does not implement.
- **FR-5** Search MUST express: idle (nothing typed), loading, results, no matches, and error.

### Selection

- **FR-6** The selected asset MUST be identified by its instance id (`space` + `externalId`) and
  MUST be stored in host-synced state together with the active panel and the time window.
- **FR-7** On startup the app MUST seed its state from the host `initialState` string.
- **FR-8** Changing the selection MUST invalidate all dependent panels. A late response for a
  previously selected asset MUST NOT be rendered.

### Time series

- **FR-9** Related time series MUST be found by listing `cdf_cdm:CogniteTimeSeries/v1` filtered
  with `containsAny` on its `assets` property. Capped at 25.
- **FR-10** The latest reading per series MUST come from the time-series datapoints API using
  the instance id. Series with no datapoints MUST render as "No data", never as `0`.
- **FR-11** The chart MUST plot aggregated (`average`) datapoints over the selected window for
  numeric series only, at a granularity derived from the window. Up to 4 series are plotted.
- **FR-12** Non-numeric series (`string`, `state`) MUST be listed with their latest value but
  MUST NOT be sent to the aggregate endpoint, which does not support them.
- **FR-13** Units MUST be shown only when known: `sourceUnit` if present, otherwise the symbol
  or name resolved from the `unit` direct relation to `CogniteUnit`. Never a guessed unit.

### Work orders / activities

- **FR-14** Related activities MUST be found by listing `cdf_cdm:CogniteActivity/v1` filtered
  with `containsAny` on its `assets` property, sorted by `startTime` descending. Capped at 50.
- **FR-15** Status MUST be **derived** from the schedule fields (`startTime`, `endTime`,
  `scheduledStartTime`, `scheduledEndTime`) as one of Completed / In progress / Planned /
  Unknown. The Core Data Model has no status field on `CogniteActivity`, so no status is read
  from CDF.
- **FR-16** Status MUST be conveyed by text as well as colour.

### Documents

- **FR-17** Related files MUST be found by listing `cdf_cdm:CogniteFile/v1` filtered with
  `containsAny` on its `assets` property, sorted by `uploadedTime` descending. Capped at 50.
- **FR-18** The open action MUST obtain a download URL from the CDF files API by instance id and
  MUST open it through the Fusion host's external-navigation API, not `window.location`.
- **FR-19** The open action MUST be disabled, with a reason, for files where `isUploaded` is not
  `true`, because no content exists to fetch.

### Cross-cutting

- **FR-20** Panels MUST fail independently. A failure in documents MUST leave time series and
  work orders rendered.
- **FR-21** No mock, sample, or hard-coded industrial data may reach the production UI. Fixtures
  exist only in `*.test.ts(x)`.

## 6. Data requirements

### Views read (all in space `cdf_cdm`, version `v1`)

| View | Used for |
| --- | --- |
| `CogniteAsset` | Asset search, asset summary |
| `CogniteTimeSeries` | Related signals |
| `CogniteActivity` | Related work orders |
| `CogniteFile` | Related documents |
| `CogniteUnit` | Resolving the unit of a signal |

No new views, containers, or spaces are required. The app is read-only.

### Properties read, per view

| View | Properties |
| --- | --- |
| `CogniteAsset` | `name`, `description`, `tags`, `aliases`, `sourceId`, `parent`, `root` |
| `CogniteTimeSeries` | `name`, `description`, `type`, `isStep`, `sourceUnit`, `unit`, `assets` |
| `CogniteActivity` | `name`, `description`, `startTime`, `endTime`, `scheduledStartTime`, `scheduledEndTime`, `sourceId`, `assets` |
| `CogniteFile` | `name`, `description`, `mimeType`, `directory`, `isUploaded`, `uploadedTime`, `assets` |
| `CogniteUnit` | `name`, `symbol` |

### Relationships traversed

The three asset-to-child relationships are **reverse direct relations targeting lists**
(`CogniteAsset.timeSeries`, `.activities`, `.files`). Cognite documents that these cannot be
traversed with the graph `/query` endpoint — "Cannot traverse lists of direct relations
inwards". The documented workaround is a reverse lookup from the child view, filtering its
list-valued direct relation on the asset's `space` + `externalId`:

```
view:   cdf_cdm:CogniteActivity/v1
filter: containsAny(property: ['cdf_cdm', 'CogniteActivity/v1', 'assets'],
                    values:  [{ space: <assetSpace>, externalId: <assetExternalId> }])
```

This app therefore performs **three independent child-view lookups** instead of one graph
traversal. `CogniteAsset.parent` and `.root` are ordinary single direct relations and are read
directly off the asset.

### APIs used

| Purpose | Call |
| --- | --- |
| Asset search | `client.instances.search` |
| Asset retrieve | `client.instances.retrieve` |
| Related children, unit lookup | `client.instances.list` / `client.instances.retrieve` |
| Latest reading | `client.datapoints.retrieveLatest` |
| Chart series | `client.datapoints.retrieve` (aggregates) |
| Document open | `client.files.getDownloadUrls` then `HostAppAPI.navigateExternal` |

### Required capabilities

`dataModelsAcl:READ` on `cdf_cdm`, `dataModelInstancesAcl:READ` on the instance spaces and on
`cdf_cdm_units`, `timeSeriesAcl:READ`, and `filesAcl:READ`.

## 7. Data-model assumptions verified against Cognite documentation

| # | Assumption | Verified how | Outcome |
| --- | --- | --- | --- |
| 1 | Core data model lives in system space `cdf_cdm` | Core data model reference | Confirmed |
| 2 | `CogniteAsset` exposes `timeSeries`, `activities`, `files` as reverse direct relation **lists** | Core data model reference | Confirmed |
| 3 | Reverse direct relations targeting lists cannot be traversed by `/query` | "Querying data" concepts page, plus a Cognite Hub thread reproducing `Cannot traverse lists of direct relations inwards` | Confirmed — drove the reverse-lookup design |
| 4 | The documented reverse lookup uses `containsAny` on the child's direct-relation list with `{space, externalId}` values | "Querying data" concepts page, worked example | Confirmed |
| 5 | `CogniteActivity` has `assets`, `timeSeries`, `equipment` plus Schedulable times | Core data model reference | Confirmed |
| 6 | `CogniteActivity` has **no** status property | Core data model reference (absence) | Confirmed — status is derived in-app, see FR-15 |
| 7 | `CogniteTimeSeries.type` is an enum `numeric` / `string` / `state` | Core data model reference | Confirmed — gates aggregate queries |
| 8 | `CogniteTimeSeries.sourceUnit` is a string, `unit` is a direct relation to `CogniteUnit` | Core data model reference | Confirmed |
| 9 | Datapoints can be addressed by data-modeling `instanceId` | "Integrate with time series" guide; `@cognite/sdk` 10.13 `DatapointsQueryInstanceId` | Confirmed |
| 10 | Files can be addressed by `instanceId` for download URLs | `@cognite/sdk` 10.13 `getDownloadUrls(ids: IdEitherWithInstance[])` | Confirmed |
| 11 | View property references in filters/sorts take the form `[space, 'ExternalId/version', property]` | `PropertySortV3` documentation in `@cognite/sdk` 10.13 | Confirmed |

### Documented discrepancy

The Core Data Model reference page lists the `CogniteFile` asset link as **`asset`**
(singular). Three other sources say the property is **`assets`** (plural):

1. The `CogniteAsset` GraphQL definition — `files: [CogniteFile] @reverseDirectRelation(throughProperty: "assets")`.
2. The "Integrate files with data modeling" guide — "CogniteFile uses the `assets` property to
   associate a file with one or more CogniteAssets".
3. The Python SDK core-model class — `CogniteFileApply(assets=[...])`.

A reverse direct relation must name a property that exists on the target view, so `assets` is
the only name consistent with `CogniteAsset.files`. **This app uses `assets`** and treats the
singular spelling in the reference table as a documentation error.

## 8. UI requirements

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Asset 360 Investigation Workspace     [ search assets ▾ ]    │  compact header
├──────────────────────────────────────────────────────────────┤
│ Asset name                     tag · parent · root · tags    │  summary card
├──────────────────────────────────────────────────────────────┤
│ [ Time series ] [ Work orders ] [ Documents ]   counts       │  tabs
│                                                              │
│  panel body                                                  │
└──────────────────────────────────────────────────────────────┘
```

- Header stays one row tall; it does not consume investigation space.
- Panel counts appear on the tabs so the analyst sees what exists before clicking.

### Aura components

| Need | Component |
| --- | --- |
| Asset type-ahead | `Command` (`CommandInput` / `CommandList` / `CommandItem`) inside `Popover`, triggered by a `Button` |
| Panels | `Card`, `Tabs` |
| Tables | `DataGrid` |
| Chart | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend` |
| Time window | `SegmentedControl` |
| Status, tags, counts | `Badge` |
| Actions | `Button` |
| Loading | `Skeleton`, `Loader` |
| Empty | `EmptyState` |
| Error | `Alert` |
| Truncated text | `Tooltip` |

Aura's `Combobox` is **not** used for search: it takes a static `options` array and exposes no
input-change callback, so it cannot drive a server-side type-ahead. `Command` is the Aura
primitive that does.

### States

Every data-dependent region implements five states:

| State | Treatment |
| --- | --- |
| Initial | Plain instruction telling the analyst to search for a tag |
| Loading | `Skeleton` rows / chart block, `aria-busy` on the region |
| Populated | Table, chart, or list |
| Empty | `EmptyState` naming the asset and what was not found |
| Error | `Alert` with a plain-language sentence and a Retry button |

Error copy never shows a stack trace or a raw SDK message. Raw errors go to `console.error`.

## 9. Acceptance criteria

1. Typing three characters of a real tag in `publicdatacdm` shows matching assets within one
   debounce interval.
2. Selecting an asset renders its name and identifier, and starts all three panels.
3. A numeric signal with datapoints renders a line in the chart and a latest value with a
   timestamp; a signal without datapoints renders "No data".
4. Related activities render newest-first with a derived status label.
5. Related documents render with type, and a document with `isUploaded: true` opens in a new tab.
6. A document with `isUploaded` not `true` shows a disabled open action with a reason.
7. Forcing one endpoint to fail leaves the other two panels working.
8. Switching assets replaces all panel content; no value from the previous asset remains.
9. Reloading the page restores the selected asset, active panel, and window.
10. The entire journey is operable from the keyboard.
11. `tsc`, `eslint`, `vitest`, and `vite build` all pass.

## 10. Non-functional requirements

- **Performance** — search debounced and capped at 25; children capped at 25/50/50; one batched
  datapoints call for latest values and one for the chart; React Query dedupes and caches per
  asset so returning to a previously viewed asset is instant.
- **Typing** — no `any`. No `as` casts outside `Partial<T> as T` in tests. All CDF property
  reads go through type guards, because a view property may be absent or of another type.
- **Accessibility** — labelled search input, labelled data grids, labelled chart with a text
  summary beside it, visible focus, status conveyed by text plus colour, `aria-busy` while
  loading.
- **Security** — no credentials, tokens, or secrets in the repo or client code. Auth is the
  Fusion user token via `CogniteSdkProvider`. The cluster URL and project come from the host
  handshake, not from app config.
- **Testability** — every service, hook, and panel takes its dependencies by injection, so tests
  never touch the network.

## 11. Out of scope

3D and P&ID viewers; equipment as a first-class concept; annotations; writing back to CDF;
alarm/event ingestion; cross-asset comparison; saved investigations.
