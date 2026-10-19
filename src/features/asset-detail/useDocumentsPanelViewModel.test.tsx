import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDocumentsPanelViewModel } from './useDocumentsPanelViewModel';

import type { FileServiceStub } from '@/__mocks__/fileService';
import { createFileServiceStub, makeFile } from '@/__mocks__/fileService';
import { createTestQueryClient } from '@/__mocks__/queryClient';
import { CdfServiceError } from '@/services/cdfError';
import {
  DEFAULT_FILE_SERVICE_DEPS,
  FileServiceContext,
} from '@/services/useFileService';

const ASSET = { space: 'my-space', externalId: 'PUMP-001' };
const PDF_FILE = makeFile('DOC-1', {
  name: 'P&ID',
  mimeType: 'application/pdf',
});

describe(useDocumentsPanelViewModel.name, () => {
  let service: FileServiceStub;

  beforeEach(() => {
    service = createFileServiceStub();
  });

  it('loads files with the current asset identity without generating URLs', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID', mimeType: 'application/pdf' }),
    ]);

    const { result } = renderHook(
      () => useDocumentsPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(service.getAssetFiles).toHaveBeenCalledWith(ASSET);
    expect(result.current.files[0]?.name).toBe('P&ID');
    expect(service.getDownloadUrl).not.toHaveBeenCalled();
  });

  it('exposes loading and empty success states', async () => {
    let resolve: (files: []) => void = () => undefined;
    service.getAssetFiles.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const { result } = renderHook(
      () => useDocumentsPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );
    expect(result.current.status).toBe('loading');

    act(() => resolve([]));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.files).toEqual([]);
  });

  it('classifies a list error and retries only when asked', async () => {
    service.getAssetFiles.mockRejectedValueOnce(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );
    const { result } = renderHook(
      () => useDocumentsPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorKind).toBe('no-access');
    expect(service.getAssetFiles).toHaveBeenCalledTimes(1);

    service.getAssetFiles.mockResolvedValue([makeFile('DOC-1')]);
    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(service.getAssetFiles).toHaveBeenCalledTimes(2);
  });

  it('does not display a late response for an old asset', async () => {
    let resolveOld: (files: ReturnType<typeof makeFile>[]) => void = () =>
      undefined;
    service.getAssetFiles
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockResolvedValueOnce([makeFile('VALVE-DOC')]);
    const { result, rerender } = renderHook(
      ({ asset }) => useDocumentsPanelViewModel(asset),
      { initialProps: { asset: ASSET }, wrapper: makeWrapper() }
    );

    rerender({ asset: { space: 'my-space', externalId: 'VALVE-9' } });
    await waitFor(() => expect(result.current.files[0]?.externalId).toBe('VALVE-DOC'));
    act(() => resolveOld([makeFile('PUMP-DOC')]));

    expect(result.current.files[0]?.externalId).toBe('VALVE-DOC');
  });

  it('generates a temporary URL only after the user selects a supported file', async () => {
    service.getAssetFiles.mockResolvedValue([PDF_FILE]);
    service.getDownloadUrl.mockResolvedValue(
      'https://files.example.test/temporary/DOC-1'
    );
    const { result } = renderHook(
      () => useDocumentsPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(service.getDownloadUrl).not.toHaveBeenCalled();

    act(() => result.current.selectFile(PDF_FILE));

    await waitFor(() => expect(result.current.previewStatus).toBe('ready'));
    expect(service.getDownloadUrl).toHaveBeenCalledWith({
      space: PDF_FILE.space,
      externalId: PDF_FILE.externalId,
    });
    expect(result.current.selectedFile).toEqual(PDF_FILE);
    expect(result.current.previewType).toBe('pdf');
    expect(result.current.previewUrl).toBe(
      'https://files.example.test/temporary/DOC-1'
    );
  });

  it('selects an unsupported file without requesting a temporary URL', async () => {
    const unsupported = makeFile('DOC-TXT', { mimeType: 'text/plain' });
    const { result } = renderHook(
      () => useDocumentsPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.selectFile(unsupported));

    await waitFor(() => expect(result.current.previewStatus).toBe('ready'));
    expect(result.current.selectedFile).toEqual(unsupported);
    expect(result.current.previewType).toBe('unsupported');
    expect(result.current.previewUrl).toBeUndefined();
    expect(service.getDownloadUrl).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    'distinguishes HTTP %s no-access while generating a URL',
    async (status) => {
    service.getDownloadUrl.mockRejectedValue(
      new CdfServiceError('Forbidden', { kind: 'no-access', status })
    );
    const { result } = renderHook(
      () => useDocumentsPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.selectFile(PDF_FILE));

    await waitFor(() => expect(result.current.previewStatus).toBe('error'));
    expect(result.current.previewErrorKind).toBe('no-access');
    }
  );

  it('reports a generic download-link failure', async () => {
    service.getDownloadUrl.mockRejectedValue(new Error('Network failure'));
    const { result } = renderHook(
      () => useDocumentsPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );

    act(() => result.current.selectFile(PDF_FILE));

    await waitFor(() => expect(result.current.previewStatus).toBe('error'));
    expect(result.current.previewErrorKind).toBe('unknown');
  });

  it('clears the temporary URL and selected file when the preview closes', async () => {
    service.getDownloadUrl.mockResolvedValue(
      'https://files.example.test/temporary/DOC-1'
    );
    const { result } = renderHook(
      () => useDocumentsPanelViewModel(ASSET),
      { wrapper: makeWrapper() }
    );
    act(() => result.current.selectFile(PDF_FILE));
    await waitFor(() => expect(result.current.previewStatus).toBe('ready'));

    act(() => result.current.closePreview());

    await waitFor(() => expect(result.current.previewStatus).toBe('idle'));
    expect(result.current.selectedFile).toBeUndefined();
    expect(result.current.previewUrl).toBeUndefined();
  });

  function makeWrapper() {
    const queryClient = createTestQueryClient();
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <FileServiceContext.Provider
            value={{
              ...DEFAULT_FILE_SERVICE_DEPS,
              useFileService: () => service,
            }}
          >
          {children}
          </FileServiceContext.Provider>
        </QueryClientProvider>
      );
    };
  }
});
