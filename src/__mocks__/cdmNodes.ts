import type { NodeDefinition, PropertyValueGroupV3, ViewReference } from '@cognite/sdk';

import { viewPropertyKey } from '../cdm/views';

export const TEST_SPACE = 'test-instances';

/**
 * Builds a data-modeling node shaped exactly as the instances API returns one,
 * with properties nested under `properties[space]['ExternalId/version']`.
 */
export function cdmNode(
  view: ViewReference,
  externalId: string,
  properties: PropertyValueGroupV3,
  space: string = TEST_SPACE
): NodeDefinition {
  return {
    instanceType: 'node',
    space,
    externalId,
    version: 1,
    createdTime: 0,
    lastUpdatedTime: 0,
    properties: {
      [view.space]: {
        [viewPropertyKey(view)]: properties,
      },
    },
  };
}

/** A node carrying no property bag for the requested view. */
export function bareNode(externalId: string, space: string = TEST_SPACE): NodeDefinition {
  return {
    instanceType: 'node',
    space,
    externalId,
    version: 1,
    createdTime: 0,
    lastUpdatedTime: 0,
  };
}
