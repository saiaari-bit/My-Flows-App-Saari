# Feature Specification: CDF workflow operations

**Feature Branch**: `001-workflow-ops`  
**Created**: 2026-09-08  
**Status**: Draft  
**Input**: User description: "IT operations console showing which CDF workflows are running, how long they have been running, overall analog operating cost, cost split by Functions and Transformations, performance issues, drill-in to a workflow, and save-cost recommendations. User-level consumption is out of scope for v1."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See live and recent workflow load (Priority: P1)

An IT operations person opens the app in Fusion on project `celanse-dev`. They see which Cognite Workflows are running right now (elapsed time) and which executions ran in the last 24 hours (duration and status).

**Why this priority**: This is the reason the app exists — they cannot currently see load without hopping through Fusion Workflows, Functions, and Transformations separately.

**Independent Test**: With a mocked operations service returning one running and one completed execution, the home list shows both with duration and status.

**Acceptance Scenarios**:

1. **Given** the SDK is connected, **When** the dashboard loads, **Then** running executions show status Running and a growing elapsed time.
2. **Given** executions in the last 24 hours, **When** the list renders, **Then** each row shows workflow id, status, and duration.
3. **Given** the project has no executions, **When** the dashboard loads, **Then** an empty state explains that nothing ran in the window.

---

### User Story 2 - See analog operating cost by subcategory (Priority: P1)

The same person sees overall estimated analog cost for the last 24 hours, split into Functions and Transformations, with a visible disclaimer that this is not a Cognite invoice.

**Why this priority**: They asked for overall costs and subcategory (Functions, Transformations) in v1.

**Independent Test**: Feed known function and transformation runtimes into the cost functions and assert USD matches the documented Azure analog formulas.

**Acceptance Scenarios**:

1. **Given** function and transformation runtimes in the window, **When** totals render, **Then** overall analog $ equals Functions $ plus Transformations $.
2. **Given** any cost figure on screen, **When** the user reads the cost card, **Then** they see that figures are Azure East US analogs, not Cognite billing.

---

### User Story 3 - Drill into one workflow (Priority: P2)

They select a workflow execution and see its tasks, durations, statuses, and analog cost contribution.

**Why this priority**: Needed to “dig deep” without leaving the app.

**Independent Test**: Selecting a row shows task-level duration and status from the service payload.

**Acceptance Scenarios**:

1. **Given** a listed execution, **When** the user selects it, **Then** the detail panel shows tasks (function / transformation / other) with status and duration.
2. **Given** a selected execution, **When** the page is reloaded with host-synced state, **Then** the same execution is selected.

---

### User Story 4 - See performance issues and save-cost recommendations (Priority: P2)

They get a short list of issues (failures, unusually long runs) and rule-based recommendations (retry waste, dominant cost, always-failing workflow).

**Why this priority**: Actionable ops outcome, not only a status table.

**Independent Test**: A fixture with two failures of the same workflow and one long-running job produces matching recommendation ids.

**Acceptance Scenarios**:

1. **Given** two or more failed executions of the same workflow in 24 hours, **When** recommendations render, **Then** a repeated-failure recommendation is shown.
2. **Given** a completed run whose duration is at least twice the median of other completed runs of that workflow, **When** recommendations render, **Then** a long-run recommendation is shown.

---

### Edge Cases

- A workflow, function, or transformation API returns 403 or 404: show the rest of the data plus an error alert for that source.
- Running execution has no end time: duration is now minus start (or created) time.
- Malformed host `initialState`: ignore and use defaults.
- User-level consumption is not shown in v1.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate via Fusion (`CogniteSdkProvider` / `useCogniteSdk`). Client id/secret and IDP env vars MUST NOT be stored in the app.
- **FR-002**: System MUST read the CDF project from the authenticated SDK client (expected `celanse-dev` when Fusion is open on that project). Cluster for deploy config is `az-eastus-1` (`https://az-eastus-1.cognitedata.com`).
- **FR-003**: System MUST list Cognite Workflow executions that are running now and those created in the last 24 hours.
- **FR-004**: System MUST show elapsed or completed duration for each execution.
- **FR-005**: System MUST estimate analog USD for Functions using Azure Functions Consumption East US rates: $0.000016 per GB-second and $0.20 per million executions, with 2.0 GB RAM unless the function record supplies memory.
- **FR-006**: System MUST estimate analog USD for Transformations using Azure Databricks Jobs Compute analog: duration hours × 2 DBU × $0.30 per DBU-hour.
- **FR-007**: System MUST NOT apply Azure monthly free grants on the 24-hour ops view.
- **FR-008**: System MUST show overall analog cost as Functions + Transformations, labeled as an estimate.
- **FR-009**: Users MUST be able to select an execution and see task-level status, type, and duration.
- **FR-010**: Selected execution id and active tab MUST be host-synced (`syncInternalState` / `initialState`).
- **FR-011**: System MUST produce rule-based save-cost and performance recommendations from the loaded window (repeated failures, long vs median, high share of analog cost, failed-run waste).
- **FR-012**: User-level consumption MUST be out of scope for v1.

### CDF resources (not FDM)

This feature does **not** create or read Data Modeling views. It reads:

- CDF Workflows and workflow executions
- Cognite Functions and function calls
- CDF Transformations and transformation jobs

Spaces used: none (no FDM).

### Key Entities

- **Workflow execution**: id, workflow external id, version, status, start, end, tasks
- **Function call**: function id/external id, status, start, end, memory GB
- **Transformation job**: transformation id/external id, status, start, end
- **Analog cost**: USD derived from documented Azure rates
- **Recommendation**: id, severity, title, rationale

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An ops user can see live plus last-24-hour workflow executions without opening the Fusion Workflows UI.
- **SC-002**: Analog Functions and Transformations dollars sum to the overall figure for the same window.
- **SC-003**: Selecting an execution shows task details in one click.
- **SC-004**: Repeated failures in the window produce at least one recommendation the user can act on (investigate or disable a schedule).

## Assumptions

- The user is logged into Fusion on a project that contains workflows (target: `celanse-dev` on `az-eastus-1`).
- Celanese IT is the design persona; data stays on the Cognite/Celanese CDF project they have open.
- Analog $ is a planning signal, not finance-grade billing.
- Transformation cluster size is not in the CDF API; 2 DBU per job-hour is the v1 assumption.
- IDP client credentials the user holds are for other tools (scripts, Streamlit). This Flows app uses the Fusion user token only.
- User consumption by identity is a later release.
