import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DocumentsPanel } from './DocumentsPanel';
import {
  DEFAULT_DOCUMENTS_PANEL_DEPS,
  DocumentsPanelContext,
} from './DocumentsPanelContext';

import type { FileServiceStub } from '@/__mocks__/fileService';
import { createFileServiceStub, makeFile } from '@/__mocks__/fileService';
import { createTestQueryClient } from '@/__mocks__/queryClient';
import type { CogniteFileViewer } from '@/cognite-file-viewer';
import { CdfServiceError } from '@/services/cdfError';
import {
  DEFAULT_FILE_SERVICE_DEPS,
  FileServiceContext,
} from '@/services/useFileService';

const ASSET = { space: 'my-space', externalId: 'PUMP-001' };

describe(DocumentsPanel.name, () => {
  let service: FileServiceStub;
  let viewerMode: 'success' | 'loading' | 'error';

  beforeEach(() => {
    service = createFileServiceStub();
    viewerMode = 'success';
  });

  it('shows an independent loading state', () => {
    service.getAssetFiles.mockReturnValue(new Promise(() => undefined));

    renderPanel();

    expect(screen.getByText('Loading documents...')).toBeInTheDocument();
  });

  it('renders verified document metadata without eagerly generating links', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', {
        name: 'P&ID sheet 3',
        mimeType: 'application/pdf',
        sourceUpdatedTime: Date.parse('2026-02-01T00:00:00.000Z'),
      }),
      makeFile('DOC-2', { name: 'Pump photo', mimeType: 'image/jpeg' }),
    ]);

    renderPanel();

    expect(await screen.findByText('P&ID sheet 3')).toBeInTheDocument();
    expect(screen.getByText('DOC-1')).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    expect(screen.getByText('2026-02-01T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.getByText('Pump photo')).toBeInTheDocument();
    expect(service.getDownloadUrl).not.toHaveBeenCalled();
  });

  it('renders a file when every optional display field is absent', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-EMPTY', { isUploaded: false }),
    ]);

    renderPanel();

    expect(await screen.findByRole('heading', { name: 'DOC-EMPTY' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Content unavailable' })).toBeDisabled();
    expect(screen.queryByText('Last modified')).not.toBeInTheDocument();
  });

  it('shows an empty state when no documents are linked', async () => {
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'No linked documents' })).toBeInTheDocument();
  });

  it('shows a list error and retries when asked', async () => {
    service.getAssetFiles.mockRejectedValueOnce(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );
    renderPanel();
    expect(await screen.findByText('Could not load documents')).toBeInTheDocument();
    expect(screen.getByText(/do not have access to read linked documents/i)).toBeInTheDocument();

    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID sheet 3' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('P&ID sheet 3')).toBeInTheDocument();
  });

  it('selects a PDF and previews it inline using a lazily generated URL', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID sheet 3', mimeType: 'application/pdf' }),
      makeFile('DOC-2', { name: 'Pump photo', mimeType: 'image/jpeg' }),
    ]);
    service.getDownloadUrl.mockResolvedValue(
      'https://files.example.test/temporary/DOC-1'
    );
    renderPanel();
    const openButtons = await screen.findAllByRole('button', { name: 'Preview document' });
    expect(service.getDownloadUrl).not.toHaveBeenCalled();
    const firstButton = openButtons[0];
    if (firstButton === undefined) throw new Error('Expected a document row');

    await userEvent.click(firstButton);

    expect(service.getDownloadUrl).toHaveBeenCalledTimes(1);
    expect(service.getDownloadUrl).toHaveBeenCalledWith({
      space: 'my-space',
      externalId: 'DOC-1',
    });
    expect(await screen.findByRole('dialog', { name: 'P&ID sheet 3' })).toBeInTheDocument();
    expect(screen.getByTestId('file-viewer')).toHaveTextContent('application/pdf');
    expect(screen.getByTestId('file-viewer')).toHaveTextContent(
      'https://files.example.test/temporary/DOC-1'
    );
  });

  it('selects and previews a supported image inline', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-IMG', { name: 'Pump photo', mimeType: 'image/webp' }),
    ]);
    service.getDownloadUrl.mockResolvedValue(
      'https://files.example.test/temporary/DOC-IMG'
    );
    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Preview document' })
    );

    expect(await screen.findByRole('dialog', { name: 'Pump photo' })).toBeInTheDocument();
    expect(screen.getByTestId('file-viewer')).toHaveTextContent('image/webp');
  });

  it('shows preview loading while the selected document URL is generated', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID', mimeType: 'application/pdf' }),
    ]);
    service.getDownloadUrl.mockReturnValue(new Promise(() => undefined));
    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Preview document' })
    );

    expect(screen.getByRole('dialog', { name: 'P&ID' })).toBeInTheDocument();
    expect(screen.getByText('Loading document preview...')).toBeInTheDocument();
  });

  it('shows a graceful state for unsupported MIME types without generating a URL', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-TXT', { name: 'Notes', mimeType: 'text/plain' }),
    ]);
    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Preview document' })
    );

    expect(await screen.findByText('Cannot preview this file inline')).toBeInTheDocument();
    expect(service.getDownloadUrl).not.toHaveBeenCalled();
  });

  it('shows a specific no-access error when a document cannot be opened', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { mimeType: 'application/pdf' }),
    ]);
    service.getDownloadUrl.mockRejectedValue(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );
    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Preview document' })
    );

    expect(await screen.findByText('Could not preview document')).toBeInTheDocument();
    expect(screen.getByText('You do not have access to preview this document.')).toBeInTheDocument();
  });

  it('shows a generic error when URL generation fails unexpectedly', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { mimeType: 'application/pdf' }),
    ]);
    service.getDownloadUrl.mockRejectedValue(new Error('Network failure'));
    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Preview document' })
    );

    expect(await screen.findByText('Could not preview document')).toBeInTheDocument();
    expect(screen.getByText('A temporary document link could not be generated.')).toBeInTheDocument();
  });

  it('shows a URL-safe viewer error for an expired or unavailable temporary URL', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID', mimeType: 'application/pdf' }),
    ]);
    service.getDownloadUrl.mockResolvedValue(
      'https://files.example.test/temporary/secret-token'
    );
    viewerMode = 'error';
    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Preview document' })
    );

    expect(await screen.findByText('Preview unavailable')).toBeInTheDocument();
    expect(screen.getByText(/temporary link may have expired/i)).toBeInTheDocument();
    expect(screen.queryByText(/secret-token/i)).not.toBeInTheDocument();
  });

  it('closes the preview and restores focus to the document button', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID', mimeType: 'application/pdf' }),
    ]);
    renderPanel();
    const trigger = await screen.findByRole('button', { name: 'Preview document' });
    await userEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'P&ID' });

    await userEvent.click(screen.getByRole('button', { name: 'Close preview' }));

    expect(screen.queryByRole('dialog', { name: 'P&ID' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the preview with Escape without trapping keyboard focus', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID', mimeType: 'application/pdf' }),
    ]);
    renderPanel();
    const trigger = await screen.findByRole('button', { name: 'Preview document' });
    await userEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'P&ID' });

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'P&ID' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('can select another document after closing the current preview', async () => {
    service.getAssetFiles.mockResolvedValue([
      makeFile('DOC-1', { name: 'P&ID', mimeType: 'application/pdf' }),
      makeFile('DOC-2', { name: 'Pump photo', mimeType: 'image/png' }),
    ]);
    renderPanel();
    const buttons = await screen.findAllByRole('button', { name: 'Preview document' });
    const first = buttons[0];
    const second = buttons[1];
    if (first === undefined || second === undefined) {
      throw new Error('Expected two document buttons');
    }

    await userEvent.click(first);
    await screen.findByRole('dialog', { name: 'P&ID' });
    await userEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    await userEvent.click(second);

    expect(await screen.findByRole('dialog', { name: 'Pump photo' })).toBeInTheDocument();
    expect(service.getDownloadUrl).toHaveBeenLastCalledWith({
      space: 'my-space',
      externalId: 'DOC-2',
    });
  });

  function renderPanel() {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <FileServiceContext.Provider
          value={{
            ...DEFAULT_FILE_SERVICE_DEPS,
            useFileService: () => service,
          }}
        >
          <DocumentsPanelContext.Provider
            value={{
              ...DEFAULT_DOCUMENTS_PANEL_DEPS,
              FileViewer: TestFileViewer,
            }}
          >
            <DocumentsPanel asset={ASSET} />
          </DocumentsPanelContext.Provider>
        </FileServiceContext.Provider>
      </QueryClientProvider>
    );
  }

  function TestFileViewer(
    props: ComponentProps<typeof CogniteFileViewer>
  ) {
    if (viewerMode === 'loading') return props.renderLoading?.();
    if (viewerMode === 'error') {
      return props.renderError?.(new Error('HTTP 403: secret temporary URL'));
    }
    if (props.source.type !== 'url') {
      throw new Error('DocumentsPanel must pass a temporary URL to the viewer');
    }
    return (
      <div data-testid="file-viewer">
        {props.source.mimeType} {props.source.url}
      </div>
    );
  }
});
