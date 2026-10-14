import type { ViewReference } from '@cognite/sdk';

/**
 * System space holding the Cognite Core Data Model.
 * Verified against the core data model reference documentation.
 */
export const CDM_SPACE = 'cdf_cdm';

const CDM_VERSION = 'v1';

function cdmView(externalId: string): ViewReference {
  return { type: 'view', space: CDM_SPACE, externalId, version: CDM_VERSION };
}

export const ASSET_VIEW = cdmView('CogniteAsset');
export const TIME_SERIES_VIEW = cdmView('CogniteTimeSeries');
export const ACTIVITY_VIEW = cdmView('CogniteActivity');
export const FILE_VIEW = cdmView('CogniteFile');
export const UNIT_VIEW = cdmView('CogniteUnit');

/**
 * Builds the property reference used by DMS filters and sorts.
 *
 * The documented form for a property reached through a view is
 * `[space, 'externalId/version', identifier]`.
 */
export function viewProperty(view: ViewReference, identifier: string): string[] {
  return [view.space, `${view.externalId}/${view.version}`, identifier];
}

/**
 * Key under which an instance's properties for a given view appear in a
 * `NodeDefinition.properties` bag: `properties[space]['ExternalId/version']`.
 */
export function viewPropertyKey(view: ViewReference): string {
  return `${view.externalId}/${view.version}`;
}
