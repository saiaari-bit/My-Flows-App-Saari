/** Identifier of a data-modeling instance: its space plus external id. */
export type InstanceRef = {
  space: string;
  externalId: string;
};

/** An asset as shown in search results. */
export type AssetMatch = {
  ref: InstanceRef;
  /** `name` when present, otherwise the external id, so a row is never blank. */
  label: string;
  name?: string;
  description?: string;
  aliases: string[];
};

/** The selected asset, read from `cdf_cdm:CogniteAsset/v1`. */
export type AssetSummary = {
  ref: InstanceRef;
  label: string;
  name?: string;
  description?: string;
  tags: string[];
  aliases: string[];
  /** `CogniteSourceable.sourceId` — the identifier the analyst knows from the source system. */
  sourceId?: string;
  parent?: InstanceRef;
  root?: InstanceRef;
};

/** `CogniteTimeSeries.type` — the documented enum of data point types. */
export type SignalKind = 'numeric' | 'string' | 'state' | 'unknown';

/** The latest reading of a signal, when the time series has any data points. */
export type LatestReading = {
  timestamp: number;
  value: number | string;
};

/** A time series related to the selected asset. */
export type Signal = {
  ref: InstanceRef;
  label: string;
  name?: string;
  description?: string;
  kind: SignalKind;
  isStep?: boolean;
  /** Only set when known: `sourceUnit`, else resolved from the `unit` relation. */
  unit?: string;
  latest?: LatestReading;
};

/** One point of the aggregated chart series for a signal. */
export type ChartPoint = {
  timestamp: number;
  value: number;
};

export type ChartSeries = {
  ref: InstanceRef;
  label: string;
  unit?: string;
  points: ChartPoint[];
};

/**
 * Work-order status. `CogniteActivity` has no status property in the core data
 * model, so this is derived from the schedule fields — see `workOrderStatus.ts`.
 */
export type WorkOrderStatus = 'completed' | 'inProgress' | 'planned' | 'unknown';

/** An activity related to the selected asset, presented as a work order. */
export type WorkOrder = {
  ref: InstanceRef;
  label: string;
  name?: string;
  description?: string;
  status: WorkOrderStatus;
  startTime?: number;
  endTime?: number;
  scheduledStartTime?: number;
  scheduledEndTime?: number;
  sourceId?: string;
};

/** A file related to the selected asset, presented as a document. */
export type DocumentFile = {
  ref: InstanceRef;
  label: string;
  name?: string;
  description?: string;
  mimeType?: string;
  directory?: string;
  /** Only `true` means content exists to open. */
  isUploaded: boolean;
  uploadedTime?: number;
};

export const TIME_WINDOWS = ['24h', '7d', '30d'] as const;

export type TimeWindowId = (typeof TIME_WINDOWS)[number];

export const WORKSPACE_TABS = ['signals', 'workOrders', 'documents'] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];
