---
description: Generate or refresh the CDF data model documentation (data-model.md) for the current feature. Documents CDF spaces, views, properties, and optionally ingestion/transformations/data quality for Solution Support handoff.
---

## User Input

```text
$ARGUMENTS
```

Consider any user input before proceeding (e.g. explicit space names or view IDs to include).

## Outline

1. **Load feature context**:
   - Read `.specify/feature.json` to get `feature_directory`
   - Read `{feature_directory}/spec.md`
   - If `{feature_directory}/plan.md` exists, read it too

2. **Decide whether to run** (early exit):
   - Inspect the loaded spec (and plan, if present) for any of the following CDF concepts:
     - **Data Modeling**: spaces, data models, views, containers, node types, edge types, properties on a view
     - **Ingestion / Transformations**: extractors, connectors, CDF Transformations, raw tables that feed CDF
   - If **none** of the above are referenced (directly or by clear implication), skip this command entirely:
     - Do NOT write `data-model.md`
     - Report a single line to the user: `Skipped /speckit.cdf-datamodel: feature does not interact with CDF data.`
     - Stop here.
   - Otherwise, continue with step 3.

3. **Load template**:
   - Read `.specify/templates/data-model-template.md`

4. **Determine CDF scope**:
   - Extract any CDF spaces, view names, data model names, container names, or property names mentioned in the spec and plan.

5. **Ask the user to provide missing data model details** (interactive elicitation):
   - For every required field still unknown after step 4 — spaces, data model external IDs and versions, view definitions — ask the user in a single batched message. Example:
     ```
     I need a bit more CDF detail to write data-model.md. Could you share:
     1. The space external ID(s) this feature reads from / writes to?
     2. The data model(s) used (external ID + version)?
     3. The view definitions you care about — feel free to paste the JSON/YAML straight from Fusion → Data Models, or from your generated SDK types.
     If anything is still TBD, just say "unknown" and I'll mark it as an open question.
     ```
   - Parse anything the user pastes (view JSON, SDK type definitions, screenshots described in text) and use it verbatim as the source of truth — do not paraphrase property names, types, or external IDs.
   - For anything the user explicitly marks as unknown or doesn't answer, set the field to `[NEEDS CLARIFICATION]` and add a corresponding entry to the Open Questions section.
   - Skip this step entirely if the spec/plan already contains all required information.

6. **Fill required sections** (always include):
   - **Spaces**: list every CDF space the feature reads from or writes to
   - **Data Models Used**: list each data model by name, space, version, and whether the feature reads or writes
   - **Views**: for each view, one subsection with external ID, space, container, role, and only the properties this feature actually accesses — not every property on the view

7. **Fill optional sections** (include only if there is concrete information; omit the entire section if not applicable):
   - **Containers**: include if the feature writes directly to containers or creates new containers
   - **Ingestion & Transformations**: include if data enters CDF from an external source (connectors, extractors, CDF Transforms, SDK writes from a pipeline)
   - **Data Processing & Transformations**: include if non-trivial transforms occur before data lands in the views (unit conversion, aggregation, joins, enrichment)
   - **Data Quality**: include if there are known validation rules, quality monitoring, or documented data issues
   - **Relationships / Edges**: include if the feature traverses or creates edges between node types
   - **Access Control**: include if the feature requires non-standard permissions, specific capability groups, or write access to any space or container; omit for simple read-only features using standard CDF access
   - **Open Questions**: include only if there are actual unknowns that need resolution before Solution Support can take over; omit if the data model is fully understood

8. **Write output**:
   - Write the filled document to `{feature_directory}/data-model.md`
   - If `/speckit.plan` has already run and produced a generic `data-model.md`, this replaces it.

9. **Report**:
   - Path written
   - Which optional sections were included and why
   - If Open Questions were included, prompt user to resolve them before Solution Support handoff

## Key rules

- Only run the body of this command if the feature interacts with CDF data (see step 2). When in doubt, prefer skipping over writing a near-empty file.
- Document only what is known or can be reasonably inferred from the spec and plan. Do not invent spaces, views, or properties.
- Keep the Views section focused: list only properties this feature uses, not all properties available on the view.
- Use CDF external IDs (not display names) for spaces, views, containers, and data models where known.
- The document audience is Solution Support — write for someone who knows CDF but does not know this codebase.
