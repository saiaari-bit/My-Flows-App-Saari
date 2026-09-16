import type { NodeOrEdge, PropertyValueGroupV3, RawPropertyValueV3, ViewReference } from '@cognite/sdk';

import type { InstanceRef } from '../domain/asset360Types';

import { viewPropertyKey } from './views';

/**
 * Raw property bag for one view on one instance.
 *
 * Every read goes through a type guard: a view property may be absent, and the
 * API type for a property value is a union of every possible DMS value shape.
 */
export type PropertyBag = PropertyValueGroupV3;

const EMPTY_BAG: PropertyBag = {};

/**
 * Extracts the property bag a node carries for a given view.
 * Instances returned by `/list`, `/search`, and `/retrieve` nest properties as
 * `properties[space]['ExternalId/version']`.
 */
export function propertyBag(node: NodeOrEdge, view: ViewReference): PropertyBag {
  return node.properties?.[view.space]?.[viewPropertyKey(view)] ?? EMPTY_BAG;
}

export function instanceRefOf(node: NodeOrEdge): InstanceRef {
  return { space: node.space, externalId: node.externalId };
}

export function readString(bag: PropertyBag, key: string): string | undefined {
  const value = bag[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function readNumber(bag: PropertyBag, key: string): number | undefined {
  const value = bag[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readBoolean(bag: PropertyBag, key: string): boolean | undefined {
  const value = bag[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function readStringList(bag: PropertyBag, key: string): string[] {
  const value = bag[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

/**
 * Reads a DMS `timestamp` property as epoch milliseconds.
 *
 * Accepts both shapes the API may produce: an epoch number, or an ISO-8601
 * string. An unparseable value is reported as missing rather than as `NaN`.
 */
export function readTimestamp(bag: PropertyBag, key: string): number | undefined {
  const value = bag[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isInstanceRef(value: RawPropertyValueV3 | undefined): value is InstanceRef {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record: Record<string, unknown> = { ...value };
  return typeof record.space === 'string' && typeof record.externalId === 'string';
}

/** Reads a single direct relation property, for example `CogniteAsset.parent`. */
export function readInstanceRef(bag: PropertyBag, key: string): InstanceRef | undefined {
  const value = bag[key];
  return isInstanceRef(value) ? { space: value.space, externalId: value.externalId } : undefined;
}

/** Reads a list-valued direct relation property, for example `CogniteTimeSeries.assets`. */
export function readInstanceRefList(bag: PropertyBag, key: string): InstanceRef[] {
  const value = bag[key];
  if (!Array.isArray(value)) {
    return [];
  }
  const refs: InstanceRef[] = [];
  for (const entry of value) {
    if (isInstanceRef(entry)) {
      refs.push({ space: entry.space, externalId: entry.externalId });
    }
  }
  return refs;
}

/** Stable key for an instance, used for React keys, dedupe, and query keys. */
export function instanceKey(ref: InstanceRef): string {
  return `${ref.space}:${ref.externalId}`;
}

export function sameInstance(a: InstanceRef | null, b: InstanceRef | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.space === b.space && a.externalId === b.externalId;
}
