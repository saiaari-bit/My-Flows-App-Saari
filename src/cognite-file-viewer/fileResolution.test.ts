import type { FileInfo } from '@cognite/sdk';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllFileCache, clearFileCache, resolveFileDownloadConfig } from './fileResolution';

import { createCogniteClientStub } from '@/__mocks__/cogniteClient';

beforeEach(() => {
  // Arrange: the resolver caches by `${project}:${fileId}` in a module-level
  // Map, so every test in this file must start from a clean slate.
  clearAllFileCache();
});

describe(resolveFileDownloadConfig.name, () => {
  it('resolves a natively supported file to a direct download URL with extended expiry', async () => {
    // Arrange
    const { client, post } = createCogniteClientStub();
    post.mockResolvedValue({ data: { items: [{ downloadUrl: 'https://files.example.test/a' }] } });
    const file = makeFileInfo({ id: 1, mimeType: 'image/png' });

    // Act
    const result = await resolveFileDownloadConfig(client, file);

    // Assert
    expect(result).toEqual({ url: 'https://files.example.test/a', mimeType: 'image/png' });
    expect(post).toHaveBeenCalledWith(`/api/v1/projects/${client.project}/files/downloadlink`, {
      data: { items: [{ id: 1 }] },
      params: { extendedExpiration: true },
    });
  });

  it('caches the resolved URL and does not call the API again within the cache window', async () => {
    // Arrange
    const { client, post } = createCogniteClientStub();
    post.mockResolvedValue({ data: { items: [{ downloadUrl: 'https://files.example.test/a' }] } });
    const file = makeFileInfo({ id: 2, mimeType: 'image/png' });

    // Act
    await resolveFileDownloadConfig(client, file);
    await resolveFileDownloadConfig(client, file);

    // Assert
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after clearFileCache invalidates the cached entry', async () => {
    // Arrange
    const { client, post } = createCogniteClientStub();
    post.mockResolvedValue({ data: { items: [{ downloadUrl: 'https://files.example.test/a' }] } });
    const file = makeFileInfo({ id: 3, mimeType: 'image/png' });
    await resolveFileDownloadConfig(client, file);

    // Act
    clearFileCache(file.id, client.project);
    await resolveFileDownloadConfig(client, file);

    // Assert
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('converts an office document to a temporary PDF link via the Document Preview API', async () => {
    // Arrange
    const { client, pdfTemporaryLink } = createCogniteClientStub();
    pdfTemporaryLink.mockResolvedValue({ temporaryLink: 'https://files.example.test/preview.pdf' });
    const file = makeFileInfo({ id: 4, name: 'report.docx', mimeType: undefined });

    // Act
    const result = await resolveFileDownloadConfig(client, file);

    // Assert
    expect(result).toEqual({
      url: 'https://files.example.test/preview.pdf',
      mimeType: 'application/pdf',
    });
    expect(pdfTemporaryLink).toHaveBeenCalledWith(4);
  });

  it('throws for a file type with no supported preview path', async () => {
    // Arrange
    const { client } = createCogniteClientStub();
    const file = makeFileInfo({ id: 5, name: 'archive.zip', mimeType: 'application/zip' });

    // Act / Assert
    await expect(resolveFileDownloadConfig(client, file)).rejects.toThrow(
      'Unsupported file type (id: 5, name: archive.zip, mimeType: application/zip)'
    );
  });

  it('throws when the download-link API returns no URL', async () => {
    // Arrange
    const { client, post } = createCogniteClientStub();
    post.mockResolvedValue({ data: { items: [] } });
    const file = makeFileInfo({ id: 6, mimeType: 'image/png' });

    // Act / Assert
    await expect(resolveFileDownloadConfig(client, file)).rejects.toThrow('No download URL for file 6');
  });

  it('evicts the oldest cache entries once the cache exceeds its maximum size', async () => {
    // Arrange: MAX_CACHE_SIZE is 200, so a 201st distinct file id forces eviction
    // of the earliest inserted entry (id 1).
    const { client, post } = createCogniteClientStub();
    post.mockImplementation(() =>
      Promise.resolve({ data: { items: [{ downloadUrl: 'https://files.example.test/x' }] } })
    );

    // Act
    for (let id = 1; id <= 201; id += 1) {
      await resolveFileDownloadConfig(client, makeFileInfo({ id, mimeType: 'image/png' }));
    }
    post.mockClear();
    await resolveFileDownloadConfig(client, makeFileInfo({ id: 1, mimeType: 'image/png' }));

    // Assert: id 1 was evicted, so resolving it again hits the API instead of the cache
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe(clearAllFileCache.name, () => {
  it('clears every cached entry regardless of project or file id', async () => {
    // Arrange
    const { client, post } = createCogniteClientStub();
    post.mockResolvedValue({ data: { items: [{ downloadUrl: 'https://files.example.test/a' }] } });
    const file = makeFileInfo({ id: 7, mimeType: 'image/png' });
    await resolveFileDownloadConfig(client, file);

    // Act
    clearAllFileCache();
    await resolveFileDownloadConfig(client, file);

    // Assert
    expect(post).toHaveBeenCalledTimes(2);
  });
});

function makeFileInfo(overrides: Partial<FileInfo> & { id: number }): FileInfo {
  return {
    name: 'file.png',
    uploaded: true,
    ...overrides,
  } as Partial<FileInfo> as FileInfo;
}
