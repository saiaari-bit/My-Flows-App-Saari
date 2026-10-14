import { CogniteError } from '@cognite/sdk';
import { describe, expect, it, vi } from 'vitest';

import type { CdfPostOptions, InstanceListParams, InstanceListResponse } from './cdm';
import type { FileServiceClient } from './fileService';
import { CdmFileService } from './fileService';

describe(`${CdmFileService.name}.getAssetFiles`, () => {
  it('retains the documented plural assets assumption pending live-project verification', async () => {
    // Arrange
    const { service, list } = buildService({
      fileNodes: [
        buildFileNode('DOC-1', {
          name: 'P&ID sheet 3',
          description: 'Piping and instrumentation diagram',
          mimeType: 'application/pdf',
          directory: '/plant/pumps',
          isUploaded: true,
          uploadedTime: 1730000000000,
          sourceUpdatedTime: '2026-02-01T00:00:00.000Z',
        }),
      ],
    });

    // Act
    const files = await service.getAssetFiles({ space: 'sp', externalId: 'PUMP-1' });

    // Assert
    // Phase 4a found conflicting Cognite docs (`asset` versus `assets`). The
    // owning-view examples support plural `assets`, but no authenticated live
    // project has verified it yet. This assertion prevents a speculative
    // one-character change that would silently turn the panel empty.
    expect(list.mock.calls[0]?.[0]).toMatchObject({
      instanceType: 'node',
      sources: [{ source: { type: 'view', space: 'cdf_cdm', externalId: 'CogniteFile', version: 'v1' } }],
      filter: {
        containsAny: {
          property: ['cdf_cdm', 'CogniteFile/v1', 'assets'],
          values: [{ space: 'sp', externalId: 'PUMP-1' }],
        },
      },
      limit: 1000,
    });
    expect(files).toEqual([
      {
        space: 'sp',
        externalId: 'DOC-1',
        name: 'P&ID sheet 3',
        description: 'Piping and instrumentation diagram',
        mimeType: 'application/pdf',
        directory: '/plant/pumps',
        isUploaded: true,
        uploadedTime: 1730000000000,
        sourceUpdatedTime: Date.parse('2026-02-01T00:00:00.000Z'),
        lastUpdatedTime: 1730000000001,
      },
    ]);
  });

  it('treats a file with no isUploaded flag as not uploaded, so the panel can badge it', async () => {
    const { service } = buildService({ fileNodes: [buildFileNode('DOC-1', { name: 'Datasheet' })] });

    const files = await service.getAssetFiles({ space: 'sp', externalId: 'PUMP-1' });

    expect(files[0]?.isUploaded).toBe(false);
  });

  it('leaves an unknown mime type undefined, which is the cannot-preview case', async () => {
    const { service } = buildService({ fileNodes: [buildFileNode('DOC-1', { name: 'Mystery' })] });

    const files = await service.getAssetFiles({ space: 'sp', externalId: 'PUMP-1' });

    expect(files[0]?.mimeType).toBeUndefined();
  });

  it('returns an empty list when the asset has no linked files', async () => {
    const { service } = buildService({});

    expect(await service.getAssetFiles({ space: 'sp', externalId: 'PUMP-1' })).toEqual([]);
  });

  it('reports a forbidden read as a no-access service error, isolating this panel', async () => {
    const { service } = buildService({ listError: new CogniteError('Forbidden', 403) });

    await expect(service.getAssetFiles({ space: 'sp', externalId: 'PUMP-1' })).rejects.toMatchObject({
      kind: 'no-access',
      status: 403,
    });
  });
});

describe(`${CdmFileService.name}.getDownloadUrl`, () => {
  it('requests the link by instance id, with the extended expiration the SDK cannot express', async () => {
    // Arrange
    const { service, post } = buildService({
      downloadBody: { items: [{ downloadUrl: 'https://files.example.test/DOC-1' }] },
    });

    // Act
    const url = await service.getDownloadUrl({ space: 'sp', externalId: 'DOC-1' });

    // Assert
    expect(post.mock.calls[0]?.[0]).toBe('/api/v1/projects/test-project/files/downloadlink');
    expect(post.mock.calls[0]?.[1]).toEqual({
      data: { items: [{ instanceId: { space: 'sp', externalId: 'DOC-1' } }] },
      params: { extendedExpiration: true },
    });
    expect(url).toBe('https://files.example.test/DOC-1');
  });

  it('never fetches the file content itself', async () => {
    const { service, post } = buildService({
      downloadBody: { items: [{ downloadUrl: 'https://files.example.test/DOC-1' }] },
    });

    await service.getDownloadUrl({ space: 'sp', externalId: 'DOC-1' });

    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an empty items array', { items: [] }],
    ['an item with no url', { items: [{}] }],
    ['a non-string url', { items: [{ downloadUrl: 42 }] }],
    ['a body that is not an object', 'nope'],
    ['an insecure url', { items: [{ downloadUrl: 'http://files.example.test/DOC-1' }] }],
    ['an invalid url', { items: [{ downloadUrl: 'not a URL' }] }],
  ])('fails with a service error when the response carries %s', async (_label, downloadBody) => {
    const { service } = buildService({ downloadBody });

    await expect(service.getDownloadUrl({ space: 'sp', externalId: 'DOC-1' })).rejects.toMatchObject({
      name: 'CdfServiceError',
      kind: 'unknown',
    });
  });

  it('reports a throttled download-link request as transient', async () => {
    const { service } = buildService({ downloadError: new CogniteError('Too many requests', 429) });

    await expect(service.getDownloadUrl({ space: 'sp', externalId: 'DOC-1' })).rejects.toMatchObject({
      kind: 'transient',
      status: 429,
    });
  });

  it('reports a missing file as a no-access or generic error, never as a silent empty url', async () => {
    const missing = [{ instanceId: { space: 'sp', externalId: 'DOC-1' } }];
    const { service } = buildService({
      downloadError: new CogniteError('Not found', 400, undefined, { missing }),
    });

    await expect(service.getDownloadUrl({ space: 'sp', externalId: 'DOC-1' })).rejects.toMatchObject({
      kind: 'unknown',
      missing,
    });
  });
});

type ServiceHarnessOptions = {
  fileNodes?: InstanceListResponse['items'];
  downloadBody?: unknown;
  listError?: Error;
  downloadError?: Error;
};

function buildService(options: ServiceHarnessOptions) {
  const list = vi.fn(async (_params: InstanceListParams): Promise<InstanceListResponse> => {
    if (options.listError) throw options.listError;
    return { items: options.fileNodes ?? [] };
  });

  const post = vi.fn(async (_path: string, _options?: CdfPostOptions): Promise<{ data: unknown }> => {
    if (options.downloadError) throw options.downloadError;
    return { data: options.downloadBody ?? { items: [] } };
  });

  const client: FileServiceClient = { instances: { list }, post, project: 'test-project' };

  return { service: new CdmFileService(client), client, list, post };
}

function buildFileNode(
  externalId: string,
  properties: Record<string, string | number | boolean>
): InstanceListResponse['items'][number] {
  return {
    instanceType: 'node',
    space: 'sp',
    externalId,
    version: 1,
    createdTime: 0,
    lastUpdatedTime: 1730000000001,
    properties: { cdf_cdm: { 'CogniteFile/v1': properties } },
  };
}
