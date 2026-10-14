import {
  Alert,
  AlertActions,
  AlertButton,
  AlertDescription,
  AlertTitle,
} from '@cognite/aura/components/alert';
import { Badge } from '@cognite/aura/components/badge';
import { Button } from '@cognite/aura/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderEnd,
  CardHeaderStart,
  CardTitle,
} from '@cognite/aura/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@cognite/aura/components/dialog';
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from '@cognite/aura/components/empty-state';
import { Loader } from '@cognite/aura/components/loader';
import { useContext, useRef } from 'react';

import { DocumentsPanelContext } from './DocumentsPanelContext';
import { useDocumentsPanelViewModel } from './useDocumentsPanelViewModel';

import type { InstanceRef } from '@/host/hostState';
import type { ServiceErrorKind } from '@/services/cdfError';
import { instanceIdKey } from '@/services/cdm';
import type { AssetFile } from '@/services/fileService';

const LIST_ERRORS: Record<ServiceErrorKind, string> = {
  'no-access': 'You do not have access to read linked documents for this asset.',
  transient: 'The linked documents could not be loaded. Try again in a moment.',
  unknown: 'The linked documents could not be loaded.',
};

const PREVIEW_ERRORS: Record<ServiceErrorKind, string> = {
  'no-access': 'You do not have access to preview this document.',
  transient: 'A temporary document link could not be generated. Try again in a moment.',
  unknown: 'A temporary document link could not be generated.',
};

export function DocumentsPanel({ asset }: { asset: InstanceRef }) {
  const viewModel = useDocumentsPanelViewModel(asset);
  const { FileViewer } = useContext(DocumentsPanelContext);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedFile = viewModel.selectedFile;
  const selectedName = selectedFile?.name ?? selectedFile?.externalId;

  const selectFile = (file: AssetFile, trigger: HTMLButtonElement) => {
    previewTriggerRef.current = trigger;
    viewModel.selectFile(file);
  };

  return (
    <>
      <Card aria-labelledby="documents-heading">
        <CardHeader>
          <CardHeaderStart>
            <CardTitle as="h2" id="documents-heading">
              Documents
            </CardTitle>
            <CardDescription>
              Files linked to this asset in CogniteFile.
            </CardDescription>
          </CardHeaderStart>
          <CardHeaderEnd>
            <Button onClick={viewModel.refresh} size="sm" variant="secondary">
              Refresh
            </Button>
          </CardHeaderEnd>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {viewModel.status === 'loading' && <Loading />}

          {viewModel.status === 'error' && (
            <PanelError
              description={LIST_ERRORS[viewModel.errorKind ?? 'unknown']}
              onRetry={viewModel.refresh}
              title="Could not load documents"
            />
          )}

          {viewModel.status === 'ready' && viewModel.files.length === 0 && (
            <EmptyState type="no-results">
              <EmptyStateTitle as="h3">No linked documents</EmptyStateTitle>
              <EmptyStateDescription>
                This asset has no CogniteFile instances linked through its assets
                relation.
              </EmptyStateDescription>
            </EmptyState>
          )}

          {viewModel.status === 'ready' && viewModel.files.length > 0 && (
            <ul aria-label="Linked documents" className="grid min-w-0 gap-3 lg:grid-cols-2">
              {viewModel.files.map((file) => (
                <li className="min-w-0 rounded-md border p-4" key={instanceIdKey(file)}>
                  <FileSummary
                    file={file}
                    isOpening={
                      viewModel.previewStatus === 'loading' &&
                      viewModel.selectedFile !== undefined &&
                      instanceIdKey(viewModel.selectedFile) === instanceIdKey(file)
                    }
                    onOpen={(trigger) => selectFile(file, trigger)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          if (!open) viewModel.closePreview();
        }}
        open={viewModel.selectedFile !== undefined}
      >
        <DialogContent
          aria-label={selectedName}
          className="max-w-6xl"
          closeButtonLabel="Close preview"
          finalFocus={previewTriggerRef}
        >
          <DialogHeader>
            <DialogTitle>{selectedName}</DialogTitle>
            <DialogDescription>
              Inline document preview. Press Escape or use Close preview to return to the document list.
            </DialogDescription>
          </DialogHeader>

          {viewModel.previewStatus === 'loading' && <PreviewLoading />}

          {viewModel.previewStatus === 'error' && (
            <PanelError
              description={PREVIEW_ERRORS[viewModel.previewErrorKind ?? 'unknown']}
              onRetry={() => {
                if (viewModel.selectedFile !== undefined) {
                  viewModel.selectFile(viewModel.selectedFile);
                }
              }}
              title="Could not preview document"
            />
          )}

          {viewModel.previewStatus === 'ready' &&
            viewModel.previewType === 'unsupported' && (
              <EmptyState type="no-results">
                <EmptyStateTitle as="h3">
                  Cannot preview this file inline
                </EmptyStateTitle>
                <EmptyStateDescription>
                  {viewModel.selectedFile?.mimeType === undefined
                    ? 'The document has no supported MIME type.'
                    : `${viewModel.selectedFile.mimeType} is not supported for inline preview.`}
                </EmptyStateDescription>
              </EmptyState>
            )}

          {viewModel.previewStatus === 'ready' &&
            viewModel.previewType !== 'unsupported' &&
            viewModel.previewUrl !== undefined &&
            selectedFile !== undefined && (
              <section aria-label={`${selectedName} preview`}>
                <FileViewer
                  fitMode="page"
                  renderError={() => (
                    <ViewerLoadError
                      onRetry={() => viewModel.selectFile(selectedFile)}
                    />
                  )}
                  renderLoading={PreviewLoading}
                  renderUnsupported={() => (
                    <p>This document cannot be previewed inline.</p>
                  )}
                  showAnnotations={false}
                  source={{
                    type: 'url',
                    url: viewModel.previewUrl,
                    mimeType: toViewerMimeType(
                      viewModel.previewType,
                      selectedFile.mimeType
                    ),
                  }}
                  style={{ height: '65vh', width: '100%' }}
                />
              </section>
            )}

        </DialogContent>
      </Dialog>
    </>
  );
}

function FileSummary({
  file,
  isOpening,
  onOpen,
}: {
  file: AssetFile;
  isOpening: boolean;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const lastModified =
    file.sourceUpdatedTime ?? file.lastUpdatedTime ?? file.uploadedTime;

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <div className="min-w-0">
        <h3 className="truncate font-medium">{file.name ?? file.externalId}</h3>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
          <Badge background variant="nordic">
            {file.externalId}
          </Badge>
          {file.mimeType !== undefined && (
            <Badge background variant="mountain">
              {file.mimeType}
            </Badge>
          )}
        </div>
      </div>
      {lastModified !== undefined && (
        <p className="text-sm text-muted-foreground">
          Last modified{' '}
          <time dateTime={toIsoTimestamp(lastModified)}>
            {toIsoTimestamp(lastModified)}
          </time>
        </p>
      )}
      <div>
        <Button
          disabled={!file.isUploaded || isOpening}
          onClick={(event) => onOpen(event.currentTarget)}
          size="sm"
          variant="secondary"
        >
          {!file.isUploaded
            ? 'Content unavailable'
            : isOpening
              ? 'Opening...'
              : 'Preview document'}
        </Button>
      </div>
    </article>
  );
}

function PreviewLoading() {
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-3 text-muted-foreground"
      role="status"
    >
      <Loader size={20} />
      <span>Loading document preview...</span>
    </div>
  );
}

function ViewerLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <PanelError
      description="The temporary link may have expired or the file content is unavailable. Generate a new link and try again."
      onRetry={onRetry}
      title="Preview unavailable"
    />
  );
}

function toViewerMimeType(
  previewType: 'pdf' | 'image' | 'unsupported' | undefined,
  mimeType: string | undefined
): string | undefined {
  if (previewType === 'pdf') return 'application/pdf';
  if (previewType === 'image') {
    return mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  }
  return undefined;
}

function Loading() {
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-3 text-muted-foreground"
      role="status"
    >
      <Loader size={20} />
      <span>Loading documents...</span>
    </div>
  );
}

function PanelError({
  description,
  onRetry,
  title,
}: {
  description: string;
  onRetry: () => void;
  title: string;
}) {
  return (
    <Alert alertStyle="card" variant="error">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      <AlertActions>
        <AlertButton onClick={onRetry} type="button">
          Try again
        </AlertButton>
      </AlertActions>
    </Alert>
  );
}

function toIsoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}
