import type {
  ByIdsResponse,
  DatapointAggregates,
  Datapoints,
  DatapointsMultiQuery,
  FileLink,
  IdEitherWithInstance,
  IgnoreUnknownIds,
  LatestDataBeforeRequest,
  ListOfSpaceExternalIdsRequestWithTyping,
  NodeAndEdgeCollectionResponseWithCursorV3Response,
  NodeOrEdgeListRequestV3,
  NodeOrEdgeSearchRequest,
} from '@cognite/sdk';

import type {
  AssetMatch,
  AssetSummary,
  ChartSeries,
  DocumentFile,
  InstanceRef,
  Signal,
  WorkOrder,
} from '../domain/asset360Types';
import type { TimeWindow } from '../domain/timeWindow';

/**
 * The slice of `CogniteClient` this app uses. Narrow on purpose: tests supply a
 * plain object, and the compiler tells us if the app starts depending on more.
 */
export type Asset360Client = {
  instances: {
    search: (params: NodeOrEdgeSearchRequest) => Promise<ByIdsResponse>;
    list: (params: NodeOrEdgeListRequestV3) => Promise<NodeAndEdgeCollectionResponseWithCursorV3Response>;
    retrieve: (params: ListOfSpaceExternalIdsRequestWithTyping) => Promise<ByIdsResponse>;
  };
  datapoints: {
    retrieve: (query: DatapointsMultiQuery) => Promise<DatapointAggregates[] | Datapoints[]>;
    retrieveLatest: (
      items: LatestDataBeforeRequest[],
      params?: IgnoreUnknownIds
    ) => Promise<Datapoints[]>;
  };
  files: {
    getDownloadUrls: (ids: IdEitherWithInstance[]) => Promise<(FileLink & IdEitherWithInstance)[]>;
  };
};

/** Signals plus any non-fatal degradation, so the list survives a failed enrichment. */
export type SignalsResult = {
  signals: Signal[];
  /** Plain-language notes about data that could not be loaded, safe to display. */
  warnings: string[];
};

export interface Asset360Service {
  searchAssets(query: string): Promise<AssetMatch[]>;
  getAsset(ref: InstanceRef): Promise<AssetSummary | undefined>;
  getSignals(ref: InstanceRef): Promise<SignalsResult>;
  getChartSeries(signals: Signal[], window: TimeWindow): Promise<ChartSeries[]>;
  getWorkOrders(ref: InstanceRef): Promise<WorkOrder[]>;
  getDocuments(ref: InstanceRef): Promise<DocumentFile[]>;
  getDocumentDownloadUrl(ref: InstanceRef): Promise<string>;
}

/**
 * Error carrying a message that is safe to render. The original failure is kept
 * as `cause` for logging and never shown to the user.
 */
export class Asset360Error extends Error {
  /** Named `originalError` rather than `cause`, which needs a newer lib target. */
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'Asset360Error';
    this.originalError = originalError;
  }
}

/** Caps, so no screen can trigger an unbounded read. */
export const LIMITS = {
  assetSearch: 25,
  signals: 25,
  chartSeries: 4,
  workOrders: 50,
  documents: 50,
} as const;
