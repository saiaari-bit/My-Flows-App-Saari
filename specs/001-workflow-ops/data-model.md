# CDF Data Model: CDF workflow operations

**Feature**: [spec.md](./spec.md)  
**Created**: 2026-09-08  
**Status**: Draft

This feature does not use Cognite Data Modeling (no spaces, views, or containers). It reads **Workflows**, **Functions**, and **Transformations** REST APIs with the Fusion user token.

## Spaces

None. No FDM spaces are read or written.

## Data Models Used

None.

## Views

None.

## Ingestion & Transformations *(optional)*

| Resource | Role |
|----------|------|
| CDF Transformations jobs | Read job start/end/status to estimate analog Spark/Databricks-style cost |
| Cognite Functions calls | Read call start/end/status and optional memory for analog Azure Functions cost |
| CDF Workflow executions | Read execution and task graph for live/24h ops and drill-in |

No extractors or new transformation SQL are introduced.

## Access Control *(optional)*

The Fusion user needs list/read on workflows, functions, and transformations in project `celanse-dev`. Missing capability for one API must not hide the others (partial load + alert).
