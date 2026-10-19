---
appName: "Asset 360 Investigation Workspace"
externalId: "asset-360-investigation-workspace"
infra: "appsApi"
customer: "customer-1776204970991"
tier: "Tier 2: Operational support"
owner: "Sai Surya Aari (sai.aari@cognitedata.com)"
userCount: "About 8–15 operations analysts / reliability engineers per site (estimate)"
businessValue: "Assumption: 15–30 minutes saved per equipment investigation by removing hops across historian, CMMS, and document stores. Not a committed ARR figure."
milestones: "No customer UAT scheduled. Target: live demo on publicdata / publicdatacdm once Fusion local hosting is verified. Certification via 00-developer-certifications."
repoUrl: ""
userRole: "Operations analyst / reliability engineer at an industrial facility. Triggered by an anomaly, alarm, or operational complaint. Knows equipment by tag (for example 23-HA-9114), not CDF ids. Works at a desk or in the control room on a Fusion desktop session, typically one or two monitors. Time-pressured: the first 30 seconds decide whether the workspace is useful. Not a CDF developer."
currentProblem: "When something looks wrong on an asset, the analyst must reconstruct one picture from three systems: process values in a historian, work history in SAP or another CMMS, and P&IDs or datasheets in SharePoint or a file store. Each hop drops context. A typical investigation burns several minutes before they even know whether the asset has recent work or a relevant document, and they still miss links because nothing joins the three."
oneSentenceStory: "As an operations analyst, I want to search an asset by tag and see its process signals, work orders, and documents on one Fusion screen so that I can start an investigation in seconds instead of assembling the same picture from three systems."
successCriteria: "From Fusion, the analyst types a known tag, opens the asset, and can read its identity plus independently loaded time series, activities, and documents on one page. They explicitly pick the series to chart, change the 24h / 7d / 30d window, and preview a PDF or image inline. A reload or shared link restores the same asset, selected series, and chart range. Recently viewed assets on this device are listed on the search view."
userEvidence: "No interviews with site analysts for this build. Persona, problem, and success bar are assumptions taken from specs/002-asset-360-investigation-workspace/spec.md and typical reliability-investigation practice, not from a named plant workshop."
reviewedSections:
  - appDetails
  - who
  - problem
  - tasksAndSuccess
---

# App Brief — Asset 360 Investigation Workspace

## App details

- **Customer:** customer-1776204970991
- **Tier:** Tier 2: Operational support
- **Owner:** Sai Surya Aari (sai.aari@cognitedata.com)
- **Expected users:** About 8–15 operations analysts / reliability engineers per site (estimate)
- **Business value:** Assumption: 15–30 minutes saved per equipment investigation by removing hops across historian, CMMS, and document stores. Not a committed ARR figure.
- **Milestones:** No customer UAT scheduled. Target: live demo on publicdata / publicdatacdm once Fusion local hosting is verified. Certification via 00-developer-certifications.
- **Repository:** (not added yet)
- **App externalId:** asset-360-investigation-workspace
- **Infra:** appsApi

## Who is this app for?

Operations analyst / reliability engineer at an industrial facility. Triggered by an anomaly, alarm, or operational complaint. Knows equipment by tag (for example 23-HA-9114), not CDF ids. Works at a desk or in the control room on a Fusion desktop session, typically one or two monitors. Time-pressured: the first 30 seconds decide whether the workspace is useful. Not a CDF developer.

## What problem does this solve?

When something looks wrong on an asset, the analyst must reconstruct one picture from three systems: process values in a historian, work history in SAP or another CMMS, and P&IDs or datasheets in SharePoint or a file store. Each hop drops context. A typical investigation burns several minutes before they even know whether the asset has recent work or a relevant document, and they still miss links because nothing joins the three.

## Tasks and success

**One-sentence story.** As an operations analyst, I want to search an asset by tag and see its process signals, work orders, and documents on one Fusion screen so that I can start an investigation in seconds instead of assembling the same picture from three systems.

**Success criteria.** From Fusion, the analyst types a known tag, opens the asset, and can read its identity plus independently loaded time series, activities, and documents on one page. They explicitly pick the series to chart, change the 24h / 7d / 30d window, and preview a PDF or image inline. A reload or shared link restores the same asset, selected series, and chart range. Recently viewed assets on this device are listed on the search view.

**User evidence.** No interviews with site analysts for this build. Persona, problem, and success bar are assumptions taken from `specs/002-asset-360-investigation-workspace/spec.md` and typical reliability-investigation practice, not from a named plant workshop.
