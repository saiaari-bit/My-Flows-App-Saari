# CDF Data Model: [FEATURE NAME]

**Feature**: [link to spec.md]
**Created**: [DATE]
**Status**: Draft

<!--
  PURPOSE: This document gives Solution Support enough context about CDF data models
  to take over or support this feature. Focus on WHAT exists in CDF and WHERE it lives,
  not on application code.

  REQUIRED SECTIONS: Spaces, Data Models Used, Views — always fill these.
  OPTIONAL SECTIONS: marked with OPTIONAL below — include only if applicable,
  omit the section entirely if the feature does not involve it.
-->

## Spaces

| Space | Purpose | Owner |
|-------|---------|-------|
| [space-external-id] | [why this space is used] | [team or service that owns it] |

## Data Models Used

| Data Model | Space | Version | Role |
|------------|-------|---------|------|
| [model-external-id] | [space] | [version] | read / write / both |

## Views

<!--
  One subsection per view. List only the properties this feature actually reads or writes
  — not every property on the view.
-->

### [ViewExternalId] (Space: [space], Version: [version])

- **Container**: [container-external-id]
- **Role**: read / write / both

**Properties used**:

| Property | Type | Description | Required by feature |
|----------|------|-------------|---------------------|
| [externalId] | [direct / text / int32 / float64 / boolean / timestamp / json / ...] | [what this property represents] | yes / no |

**Filters applied when querying**: [describe any view filters, e.g. "filter by status = 'active'" — or "none"]

---

<!-- OPTIONAL: include Containers section only if the feature writes to new or existing containers directly -->

## Containers

| Container | Space | Description |
|-----------|-------|-------------|
| [container-external-id] | [space] | [what data it stores] |

<!-- END OPTIONAL: Containers -->

---

<!-- OPTIONAL: include Ingestion & Transformations only if data enters CDF from an external source for this feature -->

## Ingestion & Transformations

| Source | Mechanism | Target View | Frequency | Notes |
|--------|-----------|-------------|-----------|-------|
| [data source, e.g. SAP, OSIsoft PI, CSV upload] | [connector / CDF Transform / Extractor / SDK write] | [view external ID] | [real-time / hourly / daily / on-demand] | [caveats, e.g. "staging space first"] |

<!-- END OPTIONAL: Ingestion & Transformations -->

---

<!-- OPTIONAL: include Data Processing & Transformations only if non-trivial transforms happen before data lands in the views above -->

## Data Processing & Transformations

- [Describe each transformation step: e.g. "unit conversion from psi to bar before writing to pressure property"]
- [Any aggregations, joins, or enrichment applied]
- [Reference to CDF Transformations job name if applicable]

<!-- END OPTIONAL: Data Processing & Transformations -->

---

<!-- OPTIONAL: include Data Quality only if there are known quality rules, monitoring, or data issues -->

## Data Quality

- **Validation rules**: [e.g. "externalId must be non-empty; startTime must be before endTime"]
- **Monitoring**: [e.g. "CDF Transform job health checked in Grafana dashboard X" — or "none in place"]
- **Known data issues**: [e.g. "legacy records before 2022 have null unit property; treat as 'unknown'"]

<!-- END OPTIONAL: Data Quality -->

---

<!-- OPTIONAL: include Relationships / Edges only if the feature traverses or creates edges between node types -->

## Relationships / Edges

| From Type | Edge Type | To Type | Description |
|-----------|-----------|---------|-------------|
| [node type / view] | [relation external ID] | [node type / view] | [what the edge represents] |

<!-- END OPTIONAL: Relationships / Edges -->

<!-- OPTIONAL: include Access Control only if the feature requires non-standard permissions,
     specific capability groups, or write access to any space or container -->

## Access Control

- **Read**: [spaces and/or data sets this feature reads; CDF capability groups required]
- **Write**: [spaces and/or containers this feature writes to]

<!-- END OPTIONAL: Access Control -->

---

<!-- OPTIONAL: include Open Questions only if there are actual unknowns to resolve -->

## Open Questions

<!--
  List anything that could not be determined from the spec or plan.
  Each item should be a concrete question with a named owner if possible.
-->

- [ ] [Question] — owner: [name or team]

<!-- END OPTIONAL: Open Questions -->
