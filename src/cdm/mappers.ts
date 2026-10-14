import type { NodeOrEdge } from '@cognite/sdk';

import type {
  AssetMatch,
  AssetSummary,
  DocumentFile,
  InstanceRef,
  Signal,
  SignalKind,
  WorkOrder,
} from '../domain/asset360Types';
import { deriveWorkOrderStatus } from '../domain/workOrderStatus';

import {
  instanceRefOf,
  propertyBag,
  readBoolean,
  readInstanceRef,
  readString,
  readStringList,
  readTimestamp,
} from './properties';
import { ACTIVITY_VIEW, ASSET_VIEW, FILE_VIEW, TIME_SERIES_VIEW, UNIT_VIEW } from './views';

/** Every property read below is documented on the corresponding `cdf_cdm` v1 view. */

export function toAssetMatch(node: NodeOrEdge): AssetMatch {
  const bag = propertyBag(node, ASSET_VIEW);
  const name = readString(bag, 'name');
  return {
    ref: instanceRefOf(node),
    label: name ?? node.externalId,
    name,
    description: readString(bag, 'description'),
    aliases: readStringList(bag, 'aliases'),
  };
}

export function toAssetSummary(node: NodeOrEdge): AssetSummary {
  const bag = propertyBag(node, ASSET_VIEW);
  const name = readString(bag, 'name');
  return {
    ref: instanceRefOf(node),
    label: name ?? node.externalId,
    name,
    description: readString(bag, 'description'),
    tags: readStringList(bag, 'tags'),
    aliases: readStringList(bag, 'aliases'),
    sourceId: readString(bag, 'sourceId'),
    parent: readInstanceRef(bag, 'parent'),
    root: readInstanceRef(bag, 'root'),
  };
}

const SIGNAL_KINDS: readonly SignalKind[] = ['numeric', 'string', 'state'];

function toSignalKind(value: string | undefined): SignalKind {
  return SIGNAL_KINDS.find((kind) => kind === value) ?? 'unknown';
}

/**
 * Maps a `CogniteTimeSeries` node. The unit is left undefined when only the
 * `unit` direct relation is set; the caller resolves those separately so a
 * signal is never labelled with a guessed unit.
 */
export function toSignal(node: NodeOrEdge): Signal {
  const bag = propertyBag(node, TIME_SERIES_VIEW);
  const name = readString(bag, 'name');
  return {
    ref: instanceRefOf(node),
    label: name ?? node.externalId,
    name,
    description: readString(bag, 'description'),
    kind: toSignalKind(readString(bag, 'type')),
    isStep: readBoolean(bag, 'isStep'),
    unit: readString(bag, 'sourceUnit'),
  };
}

/** The `unit` direct relation of a `CogniteTimeSeries`, if it has one. */
export function signalUnitRelation(node: NodeOrEdge): InstanceRef | undefined {
  return readInstanceRef(propertyBag(node, TIME_SERIES_VIEW), 'unit');
}

/** Reads a `CogniteUnit` node down to the label shown next to a reading. */
export function toUnitLabel(node: NodeOrEdge): string | undefined {
  const bag = propertyBag(node, UNIT_VIEW);
  return readString(bag, 'symbol') ?? readString(bag, 'name');
}

export function toWorkOrder(node: NodeOrEdge, now: number): WorkOrder {
  const bag = propertyBag(node, ACTIVITY_VIEW);
  const name = readString(bag, 'name');
  const schedule = {
    startTime: readTimestamp(bag, 'startTime'),
    endTime: readTimestamp(bag, 'endTime'),
    scheduledStartTime: readTimestamp(bag, 'scheduledStartTime'),
    scheduledEndTime: readTimestamp(bag, 'scheduledEndTime'),
  };
  return {
    ref: instanceRefOf(node),
    label: name ?? node.externalId,
    name,
    description: readString(bag, 'description'),
    status: deriveWorkOrderStatus(schedule, now),
    sourceId: readString(bag, 'sourceId'),
    ...schedule,
  };
}

export function toDocumentFile(node: NodeOrEdge): DocumentFile {
  const bag = propertyBag(node, FILE_VIEW);
  const name = readString(bag, 'name');
  return {
    ref: instanceRefOf(node),
    label: name ?? node.externalId,
    name,
    description: readString(bag, 'description'),
    mimeType: readString(bag, 'mimeType'),
    directory: readString(bag, 'directory'),
    isUploaded: readBoolean(bag, 'isUploaded') === true,
    uploadedTime: readTimestamp(bag, 'uploadedTime'),
  };
}
