import { CdfServiceError, toCdfServiceError } from './cdfError';
import type { CdfPostClient, CdmInstance, InstanceId, InstanceListClient } from './cdm';
import {
  INSTANCE_LIST_PAGE_SIZE,
  cdmView,
  isRecord,
  linkedToAssetFilter,
  listAllInstances,
  readBoolean,
  readItems,
  readString,
  readTimestamp,
} from './cdm';

export const FILE_VIEW_EXTERNAL_ID = 'CogniteFile';

/** The document fields the documents panel needs (FR-012 – FR-015). */
export type AssetFile = {
  space: string;
  externalId: string;
  name?: string;
  description?: string;
  /**
   * Free text on the instance, never validated by CDF. Absent or unrecognised
   * means "cannot preview inline" rather than an error.
   */
  mimeType?: string;
  directory?: string;
  /** `false` means metadata exists but content does not — a download would fail. */
  isUploaded: boolean;
  uploadedTime?: number;
  sourceUpdatedTime?: number;
  /** Last change in CDF, from node identity rather than the view. */
  lastUpdatedTime?: number;
};

export interface FileService {
  getAssetFiles(assetId: InstanceId): Promise<AssetFile[]>;
  /** Returns a temporary URL for the file the user opened. Never fetches content. */
  getDownloadUrl(fileId: InstanceId): Promise<string>;
}

export type FileServiceClient = InstanceListClient & CdfPostClient;

export class CdmFileService implements FileService {
  constructor(private readonly client: FileServiceClient) {}

  /*
   * `CogniteAsset.files` is a reverse direct relation list, so the read starts
   * from the file view and filters on `CogniteFile.assets`.
   *
   * The property is `assets`, plural. The Cognite CDM reference table labels
   * this row `asset`, but the search nested-filter table, the InField
   * configuration guide, and the Toolkit resource library all use `assets` —
   * see docs/cdm-traversal-notes.md §5.1. A one-character mistake here yields
   * an empty panel rather than an error, which is why this is the first thing
   * to confirm against a live project. This repository has not yet had an
   * authenticated live-project session capable of verifying that assumption;
   * retain `assets` until that check produces concrete contrary evidence.
   */
  async getAssetFiles(assetId: InstanceId): Promise<AssetFile[]> {
    const instances = await listAllInstances(
      this.client,
      {
        instanceType: 'node',
        sources: [{ source: cdmView(FILE_VIEW_EXTERNAL_ID) }],
        filter: linkedToAssetFilter(FILE_VIEW_EXTERNAL_ID, assetId),
        limit: INSTANCE_LIST_PAGE_SIZE,
      },
      FILE_VIEW_EXTERNAL_ID
    );

    return instances.map(toAssetFile);
  }

  /*
   * Uses `client.post` rather than `client.files.getDownloadUrls` because the
   * installed SDK exposes no way to set `extendedExpiration`, and the default
   * link lifetime is 30 seconds — too short to survive a user opening a
   * document. With the flag the link lasts an hour.
   *
   * This endpoint carries its own throttling policy, so it is called for the
   * single file being opened, never for every row in the panel.
   */
  async getDownloadUrl(fileId: InstanceId): Promise<string> {
    let body: unknown;

    try {
      const response = await this.client.post(
        `/api/v1/projects/${this.client.project}/files/downloadlink`,
        {
          data: { items: [{ instanceId: { space: fileId.space, externalId: fileId.externalId } }] },
          params: { extendedExpiration: true },
        }
      );
      body = response.data;
    } catch (error) {
      throw toCdfServiceError(error);
    }

    const item = readItems(body)[0];
    const downloadUrl = isRecord(item) ? readString(item, 'downloadUrl') : undefined;

    if (downloadUrl === undefined || !isSecureDownloadUrl(downloadUrl)) {
      throw new CdfServiceError(`No valid download URL was returned for file ${fileId.externalId}`, {
        kind: 'unknown',
      });
    }

    return downloadUrl;
  }
}

function isSecureDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

function toAssetFile(instance: CdmInstance): AssetFile {
  const { properties } = instance;

  return {
    space: instance.id.space,
    externalId: instance.id.externalId,
    name: readString(properties, 'name'),
    description: readString(properties, 'description'),
    mimeType: readString(properties, 'mimeType'),
    directory: readString(properties, 'directory'),
    isUploaded: readBoolean(properties, 'isUploaded') ?? false,
    uploadedTime: readTimestamp(properties, 'uploadedTime'),
    sourceUpdatedTime: readTimestamp(properties, 'sourceUpdatedTime'),
    lastUpdatedTime: instance.lastUpdatedTime,
  };
}
