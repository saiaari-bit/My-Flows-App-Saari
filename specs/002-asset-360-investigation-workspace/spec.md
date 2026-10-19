# Asset 360 Investigation Workspace — Specification

**Status**: Implemented
**Target environment**: org `publicdata`, project `publicdatacdm`, base URL `https://api.cognitedata.com`
**Data model space**: `cdf_cdm` (Cognite Core Data Model, all views at `v1`)
**Behavior source**: matches the Asset 360 workspace in `cognitedata/charan-asset-360` (`main`)

This document supersedes `specs/001-workflow-ops/spec.md`. That feature (a workflow cost
console) has been removed from this repository.

---

## 1. Product purpose

Give an industrial operations analyst a single Fusion workspace that answers "what is this
asset, how is it behaving, what work is happening on it, and what documents describe it?"
against live Cognite Core Data Model data.

The app does not teach the data model. The user searches a tag, opens one asset, and reads
the header plus three independent panels.

## 2. Target user

**Operations Analyst / Reliability Engineer** at an industrial facility.

- Triggered by an anomaly, alarm, handover note, or reliability review.
- Knows equipment by its tag (external id), not by CDF identifiers.
- Works on a desktop or laptop inside Fusion. Phones and tablets are out of scope.
- Secondary users of the same screen: maintenance planner (activities) and field engineer
  (documents).

## 3. User journey

1. The analyst opens the app on the search view. If this browser has opened assets before,
   those appear under Recently viewed (at most 10, most recent first, stored per CDF project).
2. They type part of a tag, name, or description. After a short debounce the app searches
   `CogniteAsset` and lists matches with name, tag, and description.
3. They open a result. The app switches to the detail view and records the asset in
   host-synced state so a reload or shared link reopens the same investigation.
4. The header shows the plant tag immediately, then the display name, description, space,
   and hierarchy once the asset record loads. A missing asset shows a not-found state.
5. Three panels load independently and stay on the page together:
   - **Time series** — linked signals. Nothing is plotted until the analyst checks one or
     more series. The chart's default end is the latest actual datapoint of the selection,
     not wall-clock now. Presets are last 24 hours, 7 days, and 30 days.
   - **Activities** — linked `CogniteActivity` records with name, description, and schedule
     timestamps.
   - **Documents** — linked files. PDFs and common images (`png`, `jpeg`, `gif`, `webp`)
     preview inline. Other types show a clear "cannot preview inline" state.
6. Each panel has its own Refresh action. The app does not poll or stream.
7. A failure or missing permission in one panel leaves the others usable. A render crash
   is caught by an app-level error boundary.
8. Back to search returns to the search view and keeps the query. Opening a different asset
   clears the previous series selection and chart range.

## 4. Functional requirements

### Search and navigation

- **FR-1** Search matches tag / external id (prefix), and name and description (text search).
- **FR-2** Search is debounced and does not run for an empty query.
- **FR-3** Opening a result navigates to a dedicated detail view. Back returns to search.
- **FR-4** Recently viewed assets persist in `localStorage` for this browser and CDF project,
  capped at 10, de-duplicated, most recent first. They are not synced across devices.
- **FR-5** Host-synced state stores the view (`search` or `detail`), the search query, the
  selected asset (`space` + `externalId`), the explicitly selected time series, and the chart
  range. Malformed state falls back to search.

### Asset header

- **FR-6** The header shows display name (or the tag before the record loads), plant tag,
  space, and description.
- **FR-7** When parent, root, or path references exist, they render as a hierarchy trail.
- **FR-8** A missing asset, a no-access response, and a transient failure each have their own
  state. Refresh retries the asset read.

### Time series

- **FR-9** Linked series are listed by filtering `CogniteTimeSeries` with `containsAny` on
  `assets`.
- **FR-10** The chart stays empty until the analyst explicitly selects one or more series.
- **FR-11** The default chart end is the latest datapoint among the selected series. Presets
  (24h / 7d / 30d) are anchored to that end.
- **FR-12** The chart uses raw datapoints. Series with no datapoints do not invent a zero.
- **FR-13** List refresh and chart refresh are explicit actions. There is no background polling.
  A single user-initiated CDF call may retry HTTP 429 up to three attempts with bounded
  exponential backoff before the panel shows its transient error. That retry is part of
  the same action, not a later refresh.

### Activities

- **FR-14** Linked activities are listed by filtering `CogniteActivity` with `containsAny` on
  `assets`. Every linked activity is shown.
- **FR-15** Each row shows name, external id, description, and any scheduled or actual start
  and end times. `CogniteActivity` has no status field, so none is invented.

### Documents

- **FR-16** Linked files are listed by filtering `CogniteFile` with `containsAny` on `assets`.
- **FR-17** Opening a PDF or a common image previews it inline. Other MIME types show that
  inline preview is unavailable.
- **FR-18** The preview URL is a short-lived CDF download link requested for that one file.

### Cross-cutting

- **FR-19** Panels fail independently. A 401/403 on one panel is a "no access" state for that
  panel only.
- **FR-20** An unexpected render error is caught by an app-level error boundary with a
  recoverable screen.
- **FR-21** No mock or sample industrial data reaches the production UI.
- **FR-22** At a 1280px-wide viewport the page does not scroll horizontally.

## 5. Data requirements

### Views read (all in space `cdf_cdm`, version `v1`)

| View | Used for |
| --- | --- |
| `CogniteAsset` | Search, header, hierarchy |
| `CogniteTimeSeries` | Linked signals and the chart |
| `CogniteActivity` | Linked activities |
| `CogniteFile` | Linked documents and inline preview |

No new views, containers, or spaces. The app is read-only.

### Properties read

| View | Properties |
| --- | --- |
| `CogniteAsset` | `name`, `description`, `parent`, `root`, `path` |
| `CogniteTimeSeries` | `name`, `description`, `sourceUnit`, `assets` |
| `CogniteActivity` | `name`, `description`, `startTime`, `endTime`, `scheduledStartTime`, `scheduledEndTime`, `assets` |
| `CogniteFile` | `name`, `description`, `mimeType`, `assets` |

### Relationships traversed

The asset-to-child relationships are reverse direct relations targeting lists. Those cannot be
traversed inwards with the graph `/query` endpoint. Each child view is listed and filtered
with `containsAny` on its `assets` property. `parent`, `root`, and `path` are read from the
asset itself.

`CogniteFile` is linked through `assets` (plural). The singular `asset` spelling in one
reference table is treated as a documentation error, because `CogniteAsset.files` reverses
through `assets`.

### APIs used

| Purpose | Call |
| --- | --- |
| Tag search | `client.instances.list` with a prefix filter on `node.externalId` |
| Name and description search | `POST .../models/instances/search` with an explicit operator |
| Asset retrieve | `client.instances.retrieve` |
| Related children | `client.instances.list` |
| Latest reading and chart | `client.datapoints.retrieveLatest` and `client.datapoints.retrieve` (raw) |
| Document preview | `POST .../files/downloadlink` with `extendedExpiration` |

### Required capabilities

`dataModelInstancesAcl:READ`, `timeSeriesAcl:READ`, and `filesAcl:READ` on the spaces that hold
the instances. A missing capability surfaces as that panel's no-access state.

## 6. UI

Search is its own view. The detail view stacks the header, time series, activities, and
documents. There is no tab that hides a panel.

Aura primitives: `Search`, `Card`, `Badge`, `Button`, `Checkbox`, `Breadcrumb`, `Dialog`,
`EmptyState`, `Alert`, `Loader`. Document preview uses the in-app file viewer.

## 7. Acceptance criteria

1. Searching by tag, name, or description returns matching assets.
2. Opening an asset shows its name, tag, space, and description, and loads all three panels.
3. No time series is plotted until the analyst selects it. The chart's right edge follows the
   latest datapoint, not the current clock.
4. Activities list linked work with their schedule timestamps.
5. A PDF or common image opens inline. An unsupported type explains that it cannot be previewed.
6. Forcing one panel's request to fail leaves the other panels rendered.
7. Recently viewed survives a reload, stays at or under 10 entries, and moves a repeat visit
   to the top without duplicating it.
8. A shared link restores the asset, the selected series, and the chart range.
9. A render exception shows the error boundary instead of a blank page.
10. `tsc`, `eslint`, `vitest`, and `vite build` pass.

## 8. Out of scope

3D and P&ID markup, writing back to CDF, alarms, cross-asset comparison, saved investigations
beyond the local recently-viewed list, and phone or tablet layouts.
