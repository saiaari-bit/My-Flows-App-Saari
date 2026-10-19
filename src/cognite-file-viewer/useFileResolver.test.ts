import type { FileInfo } from '@cognite/sdk';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllFileCache } from './fileResolution';
import type { FileSource } from './types';
import { useFileResolver } from './useFileResolver';

import { createCogniteClientStub } from '@/__mocks__/cogniteClient';

beforeEach(() => {
  // fileResolution.ts caches download URLs in a module-level Map, so each
  // test starts from a clean slate.
  clearAllFileCache();
});

describe(useFileResolver.name, () => {
  it('starts in a loading state before resolution completes', () => {
    // Arrange: a pending client call keeps the hook from settling synchronously.
    const { client, filesRetrieve } = createCogniteClientStub();
    filesRetrieve.mockImplementation(() => new Promise<FileInfo[]>(() => undefined));
    const source: FileSource = { type: 'internalId', id: 1 };

    // Act
    const { result } = renderHook(() => useFileResolver(source, client));

    // Assert
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('resolves a url source directly without a client, inferring the MIME type', async () => {
    // Arrange
    const source: FileSource = { type: 'url', url: 'https://files.example.test/a.pdf' };

    // Act
    const { result } = renderHook(() => useFileResolver(source));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.url).toBe('https://files.example.test/a.pdf');
    expect(result.current.mimeType).toBe('application/pdf');
    expect(result.current.error).toBeNull();
  });

  it('honours an explicit MIME type on a url source over inference', async () => {
    // Arrange
    const source: FileSource = {
      type: 'url',
      url: 'https://files.example.test/a.pdf',
      mimeType: 'application/octet-stream',
    };

    // Act
    const { result } = renderHook(() => useFileResolver(source));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mimeType).toBe('application/octet-stream');
  });

  it('resolves a url source with no recognisable extension to an empty MIME type', async () => {
    // Arrange
    const source: FileSource = { type: 'url', url: 'https://files.example.test/README' };

    // Act
    const { result } = renderHook(() => useFileResolver(source));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mimeType).toBe('');
  });

  it('errors when an internalId source is used without a client', async () => {
    // Arrange
    const source: FileSource = { type: 'internalId', id: 42 };

    // Act
    const { result } = renderHook(() => useFileResolver(source));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe(
      'CogniteClient is required for instanceId and internalId sources'
    );
  });

  it('errors when an instanceId source is used without a client', async () => {
    // Arrange
    const source: FileSource = { type: 'instanceId', space: 'my-space', externalId: 'DOC-1' };

    // Act
    const { result } = renderHook(() => useFileResolver(source));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  it('resolves an internalId source via the client and caches the fileInfo', async () => {
    // Arrange
    const { client, filesRetrieve, post } = createCogniteClientStub();
    filesRetrieve.mockResolvedValue([makeFileInfo({ id: 42, mimeType: 'image/png' })]);
    post.mockResolvedValue({ data: { items: [{ downloadUrl: 'https://files.example.test/42' }] } });
    const source: FileSource = { type: 'internalId', id: 42 };

    // Act
    const { result } = renderHook(() => useFileResolver(source, client));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(filesRetrieve).toHaveBeenCalledWith([{ id: 42 }]);
    expect(result.current.url).toBe('https://files.example.test/42');
    expect(result.current.mimeType).toBe('image/png');
    expect(result.current.fileInfo?.id).toBe(42);
    expect(result.current.instanceId).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('resolves an instanceId source, preferring the instanceId returned by the API', async () => {
    // Arrange
    const { client, filesRetrieve, post } = createCogniteClientStub();
    filesRetrieve.mockResolvedValue([
      makeFileInfo({
        id: 7,
        mimeType: 'application/pdf',
        instanceId: { space: 'returned-space', externalId: 'returned-id' },
      }),
    ]);
    post.mockResolvedValue({ data: { items: [{ downloadUrl: 'https://files.example.test/7' }] } });
    const source: FileSource = { type: 'instanceId', space: 'req-space', externalId: 'req-id' };

    // Act
    const { result } = renderHook(() => useFileResolver(source, client));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(filesRetrieve).toHaveBeenCalledWith([
      { instanceId: { space: 'req-space', externalId: 'req-id' } },
    ]);
    expect(result.current.instanceId).toEqual({ space: 'returned-space', externalId: 'returned-id' });
  });

  it('falls back to the requested instanceId when the API omits it', async () => {
    // Arrange
    const { client, filesRetrieve, post } = createCogniteClientStub();
    filesRetrieve.mockResolvedValue([makeFileInfo({ id: 8, mimeType: 'application/pdf' })]);
    post.mockResolvedValue({ data: { items: [{ downloadUrl: 'https://files.example.test/8' }] } });
    const source: FileSource = { type: 'instanceId', space: 'req-space', externalId: 'req-id' };

    // Act
    const { result } = renderHook(() => useFileResolver(source, client));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.instanceId).toEqual({ space: 'req-space', externalId: 'req-id' });
  });

  it('surfaces an error when the client fails to retrieve file metadata', async () => {
    // Arrange
    const { client, filesRetrieve } = createCogniteClientStub();
    filesRetrieve.mockRejectedValue(new Error('boom'));
    const source: FileSource = { type: 'internalId', id: 9 };

    // Act
    const { result } = renderHook(() => useFileResolver(source, client));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
  });

  it('wraps a non-Error rejection in an Error', async () => {
    // Arrange
    const { client, filesRetrieve } = createCogniteClientStub();
    filesRetrieve.mockRejectedValue('a plain string failure');
    const source: FileSource = { type: 'internalId', id: 10 };

    // Act
    const { result } = renderHook(() => useFileResolver(source, client));

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('a plain string failure');
  });

  it('ignores a stale resolution when the source changes before it settles', async () => {
    // Arrange: id 1 never resolves within the test; id 2 resolves immediately.
    const { client, filesRetrieve, post } = createCogniteClientStub();
    filesRetrieve.mockImplementationOnce(() => new Promise<FileInfo[]>(() => undefined));
    filesRetrieve.mockImplementationOnce(() =>
      Promise.resolve([makeFileInfo({ id: 2, mimeType: 'image/png' })])
    );
    post.mockResolvedValue({ data: { items: [{ downloadUrl: 'https://files.example.test/2' }] } });

    const { result, rerender } = renderHook(
      ({ source }: { source: FileSource }) => useFileResolver(source, client),
      { initialProps: { source: { type: 'internalId', id: 1 } as FileSource } }
    );

    // Act: switch sources before the first request resolves
    rerender({ source: { type: 'internalId', id: 2 } as FileSource });

    // Assert: only the second (current) source's result is ever observed
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.url).toBe('https://files.example.test/2');
    expect(result.current.fileInfo?.id).toBe(2);
  });
});

function makeFileInfo(overrides: Partial<FileInfo> & { id: number }): FileInfo {
  return {
    name: 'file.png',
    uploaded: true,
    ...overrides,
  } as Partial<FileInfo> as FileInfo;
}
