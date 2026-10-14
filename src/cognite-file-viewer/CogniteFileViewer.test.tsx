import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CogniteFileViewer } from './CogniteFileViewer';
import type { FileSource } from './types';

import { createCogniteClientStub } from '@/__mocks__/cogniteClient';

/*
 * react-pdf drives real pdf.js parsing against `file`, which this test
 * environment cannot execute. There is no DI seam for it (it's imported
 * directly, matching the vendored skill's original shape), so the module is
 * mocked at the narrowest point: only `Document`/`Page` are replaced, and the
 * mock still renders the real `children`/`pageNumber` so CogniteFileViewer's
 * own routing and composition logic is what's actually exercised.
 */
vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ children }: { children?: ReactNode }) => (
    <div data-testid="pdf-document">{children}</div>
  ),
  Page: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid="pdf-page">{pageNumber}</div>
  ),
}));

describe(CogniteFileViewer.name, () => {
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the default loading indicator while a CDF source resolves', () => {
    // Arrange
    const { client, filesRetrieve } = createCogniteClientStub();
    filesRetrieve.mockReturnValue(new Promise(() => undefined));
    const source: FileSource = { type: 'instanceId', space: 'my-space', externalId: 'FILE-1' };

    // Act
    render(<CogniteFileViewer client={client} source={source} />);

    // Assert
    expect(screen.getByText('Loading file...')).toBeInTheDocument();
  });

  it('uses a custom renderLoading callback when provided', () => {
    // Arrange
    const { client, filesRetrieve } = createCogniteClientStub();
    filesRetrieve.mockReturnValue(new Promise(() => undefined));
    const source: FileSource = { type: 'instanceId', space: 'my-space', externalId: 'FILE-1' };

    // Act
    render(
      <CogniteFileViewer
        client={client}
        renderLoading={() => <span>Custom loading</span>}
        source={source}
      />
    );

    // Assert
    expect(screen.getByText('Custom loading')).toBeInTheDocument();
  });

  it('shows the default error view when a CDF lookup fails', async () => {
    // Arrange
    const { client, filesRetrieve } = createCogniteClientStub();
    filesRetrieve.mockRejectedValue(new Error('lookup failed'));
    const source: FileSource = { type: 'instanceId', space: 'my-space', externalId: 'FILE-1' };

    // Act
    render(<CogniteFileViewer client={client} source={source} />);

    // Assert
    expect(await screen.findByText(/Failed to load file: lookup failed/)).toBeInTheDocument();
  });

  it('uses a custom renderError callback when provided', async () => {
    // Arrange
    const { client, filesRetrieve } = createCogniteClientStub();
    filesRetrieve.mockRejectedValue(new Error('lookup failed'));
    const source: FileSource = { type: 'instanceId', space: 'my-space', externalId: 'FILE-1' };
    const renderError = vi.fn((error: Error) => <span>Custom error: {error.message}</span>);

    // Act
    render(<CogniteFileViewer client={client} renderError={renderError} source={source} />);

    // Assert
    expect(await screen.findByText('Custom error: lookup failed')).toBeInTheDocument();
    expect(renderError).toHaveBeenCalledWith(new Error('lookup failed'));
  });

  it('shows an error when a CDF source is used without a client', async () => {
    // Arrange
    const source: FileSource = { type: 'instanceId', space: 'my-space', externalId: 'FILE-1' };

    // Act
    render(<CogniteFileViewer source={source} />);

    // Assert
    expect(await screen.findByText(/CogniteClient is required/)).toBeInTheDocument();
  });

  it('renders an image element once the blob resolves for an image source', async () => {
    // Arrange
    const okResponse = { ok: true, blob: () => Promise.resolve(new Blob()) } as Partial<Response> as Response;
    fetchMock.mockResolvedValue(okResponse);
    const source: FileSource = { type: 'url', url: 'https://example.test/photo.png', mimeType: 'image/png' };

    // Act
    const { container } = render(<CogniteFileViewer source={source} />);

    // Assert
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
  });

  it('shows the default error view when the image blob fetch fails', async () => {
    // Arrange
    const notFoundResponse = { ok: false, status: 404 } as Partial<Response> as Response;
    fetchMock.mockResolvedValue(notFoundResponse);
    const source: FileSource = { type: 'url', url: 'https://example.test/missing.png', mimeType: 'image/png' };

    // Act
    render(<CogniteFileViewer source={source} />);

    // Assert
    expect(await screen.findByText(/Failed to load file: HTTP 404/)).toBeInTheDocument();
  });

  it('renders fetched text content for a text mimeType url source', async () => {
    // Arrange
    const okResponse = { ok: true, text: () => Promise.resolve('hello world') } as Partial<Response> as Response;
    fetchMock.mockResolvedValue(okResponse);
    const source: FileSource = { type: 'url', url: 'https://example.test/notes.txt', mimeType: 'text/plain' };

    // Act
    render(<CogniteFileViewer source={source} />);

    // Assert
    expect(await screen.findByText('hello world')).toBeInTheDocument();
  });

  it('shows the default error view when the text fetch fails', async () => {
    // Arrange
    const serverErrorResponse = { ok: false, status: 500 } as Partial<Response> as Response;
    fetchMock.mockResolvedValue(serverErrorResponse);
    const source: FileSource = { type: 'url', url: 'https://example.test/notes.txt', mimeType: 'text/plain' };

    // Act
    render(<CogniteFileViewer source={source} />);

    // Assert
    expect(await screen.findByText(/Failed to load file: HTTP 500/)).toBeInTheDocument();
  });

  it('routes a pdf mimeType url source to the PDF renderer', async () => {
    // Arrange
    const source: FileSource = { type: 'url', url: 'https://example.test/doc.pdf', mimeType: 'application/pdf' };

    // Act
    render(<CogniteFileViewer source={source} />);

    // Assert
    expect(await screen.findByTestId('pdf-document')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-page')).toBeInTheDocument();
  });

  it('shows the default unsupported message for an unrecognised mime type', async () => {
    // Arrange
    const source: FileSource = {
      type: 'url',
      url: 'https://example.test/data.bin',
      mimeType: 'application/octet-stream',
    };

    // Act
    render(<CogniteFileViewer source={source} />);

    // Assert
    expect(await screen.findByText(/Unsupported file type/)).toBeInTheDocument();
  });

  it('uses a custom renderUnsupported callback when provided', async () => {
    // Arrange
    const source: FileSource = { type: 'url', url: 'https://example.test/data.zip', mimeType: 'application/zip' };
    const renderUnsupported = vi.fn((mimeType: string | undefined) => <span>Custom: {mimeType}</span>);

    // Act
    render(<CogniteFileViewer renderUnsupported={renderUnsupported} source={source} />);

    // Assert
    expect(await screen.findByText('Custom: application/zip')).toBeInTheDocument();
    expect(renderUnsupported).toHaveBeenCalledWith('application/zip');
  });
});
