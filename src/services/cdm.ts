import type { CogniteClient } from '@cognite/sdk';

import { toCdfServiceError } from './cdfError';
import { runCdfCall } from './runCdfCall';

/**
 * Shared Core Data Model primitives for the service layer.
 *
 * Everything Asset 360 reads lives in the Cognite-managed `cdf_cdm` system
 * space at version `v1` (SPEC.md FR-025 / AS-A11), so the space and version are
 * pinned once here rather than repeated per service.
 */
export const CDM_SPACE = 'cdf_cdm';
export const CDM_VERSION = 'v1';

/** Documented ceiling for a single `/models/instances/list` page. */
export const INSTANCE_LIST_PAGE_SIZE = 1000;

/**
 * Identity of a Data Modeling instance. This is node identity, not a view
 * property, and it is the key every panel and deep link joins on.
 */
export type InstanceId = {
  space: string;
  externalId: string;
};

export type ViewReference = {
  type: 'view';
  space: string;
  externalId: string;
  version: string;
};

/** A node reduced to what the service layer reads: identity plus one view's properties. */
export type CdmInstance = {
  id: InstanceId;
  properties: Record<string, unknown>;
  lastUpdatedTime?: number;
};

type InstancesApi = CogniteClient['instances'];

/*
 * The instance request/response types are not re-exported from the
 * `@cognite/sdk` entry point, so they are derived from the client surface that
 * is. This keeps the installed SDK typings the source of truth without casts.
 */
export type InstanceListParams = Parameters<InstancesApi['list']>[0];
export type InstanceListResponse = Awaited<ReturnType<InstancesApi['list']>>;
export type InstanceRetrieveParams = Parameters<InstancesApi['retrieve']>[0];
export type InstanceRetrieveResponse = Awaited<ReturnType<InstancesApi['retrieve']>>;
export type InstanceNode = InstanceListResponse['items'][number];
export type ViewPropertyValues = NonNullable<InstanceNode['properties']>[string][string];

/** Narrow client slices, so a test supplies one function instead of a whole client. */
export type InstanceListClient = { instances: Pick<InstancesApi, 'list'> };
export type InstanceRetrieveClient = { instances: Pick<InstancesApi, 'retrieve'> };

export type CdfPostOptions = {
  data?: unknown;
  params?: Record<string, unknown>;
};

/**
 * The escape hatch for the two request fields the installed SDK cannot express
 * (search `operator`, download-link `extendedExpiration`).
 *
 * `data` is deliberately `unknown`: the SDK's `post` is generic, but a generic
 * response type would be an unchecked assumption about the body. Callers narrow
 * what comes back with the readers below instead.
 */
export type CdfPostClient = {
  project: string;
  post: (path: string, options?: CdfPostOptions) => Promise<{ data: unknown }>;
};

export function cdmView(externalId: string): ViewReference {
  return { type: 'view', space: CDM_SPACE, externalId, version: CDM_VERSION };
}

/**
 * A view property reference. The version is mandatory: an unversioned
 * reference is a documented cause of a filter matching nothing, with no error.
 */
export function cdmPropertyRef(viewExternalId: string, property: string): string[] {
  return [CDM_SPACE, `${viewExternalId}/${CDM_VERSION}`, property];
}

/**
 * Filter for "instances of this view that link to this asset".
 *
 * `CogniteAsset.timeSeries` / `.activities` / `.files` are reverse direct
 * relation *lists*, which cannot be traversed from the asset with `/query`.
 * The documented alternative is to query the owning view and filter on its own
 * `assets` list — see docs/cdm-traversal-notes.md §3.2.
 */
export function linkedToAssetFilter(viewExternalId: string, assetId: InstanceId) {
  return {
    containsAny: {
      property: cdmPropertyRef(viewExternalId, 'assets'),
      values: [{ space: assetId.space, externalId: assetId.externalId }],
    },
  };
}

/** Separator is a character that cannot appear in a space or external id. */
export function instanceIdKey(id: InstanceId): string {
  return `${id.space}\u0000${id.externalId}`;
}

export function dedupeByInstanceId<T extends InstanceId>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = instanceIdKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reduces one instance from any CDF response — typed SDK result or raw
 * `client.post` body alike — to identity plus the properties of one view.
 * Returns `undefined` for anything that is not a usable instance.
 */
export function readInstance(value: unknown, viewExternalId: string): CdmInstance | undefined {
  if (!isRecord(value)) return undefined;

  const { space, externalId, lastUpdatedTime } = value;
  if (typeof space !== 'string' || space === '') return undefined;
  if (typeof externalId !== 'string' || externalId === '') return undefined;

  return {
    id: { space, externalId },
    properties: readViewPropertyBag(value.properties, viewExternalId),
    lastUpdatedTime: typeof lastUpdatedTime === 'number' ? lastUpdatedTime : undefined,
  };
}

export function readInstances(values: readonly unknown[], viewExternalId: string): CdmInstance[] {
  const instances: CdmInstance[] = [];
  for (const value of values) {
    const instance = readInstance(value, viewExternalId);
    if (instance !== undefined) instances.push(instance);
  }
  return instances;
}

/** Pulls the `items` array out of a raw response body without trusting its shape. */
export function readItems(body: unknown): unknown[] {
  if (!isRecord(body)) return [];
  return Array.isArray(body.items) ? body.items : [];
}

export function readString(properties: Record<string, unknown>, key: string): string | undefined {
  const value = properties[key];
  return typeof value === 'string' ? value : undefined;
}

export function readBoolean(properties: Record<string, unknown>, key: string): boolean | undefined {
  const value = properties[key];
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Reads a timestamp property as epoch milliseconds.
 *
 * Accepts both a number and an ISO-8601 string: the wire format of a DMS
 * timestamp property value is not pinned down by the Cognite documentation
 * verified in Phase 4a, so tolerate either rather than guess one.
 */
export function readTimestamp(properties: Record<string, unknown>, key: string): number | undefined {
  const value = properties[key];
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Reads every page of an instance list.
 *
 * A panel that ignores `nextCursor` silently truncates at one page, so the
 * cursor is followed to exhaustion. An empty page also ends the loop, which
 * bounds the request count if a cursor is ever echoed back unchanged.
 */
export async function listAllInstances(
  client: InstanceListClient,
  params: InstanceListParams,
  viewExternalId: string
): Promise<CdmInstance[]> {
  const instances: CdmInstance[] = [];
  let cursor: string | undefined;

  try {
    do {
      const page = await runCdfCall(() => client.instances.list({ ...params, cursor }));
      if (page.items.length === 0) break;
      instances.push(...readInstances(page.items, viewExternalId));
      cursor = page.nextCursor;
    } while (cursor !== undefined);
  } catch (error) {
    throw toCdfServiceError(error);
  }

  return instances;
}

function readViewPropertyBag(properties: unknown, viewExternalId: string): Record<string, unknown> {
  if (!isRecord(properties)) return {};
  const spaceBag = properties[CDM_SPACE];
  if (!isRecord(spaceBag)) return {};
  const viewBag = spaceBag[`${viewExternalId}/${CDM_VERSION}`];
  return isRecord(viewBag) ? viewBag : {};
}
