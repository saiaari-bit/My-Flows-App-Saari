import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { Badge } from '@cognite/aura/components/badge';
import { Button } from '@cognite/aura/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@cognite/aura/components/tooltip';
import { DataGrid } from '@cognite/aura/data-grid';
import { IconExternalLink } from '@tabler/icons-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

import { instanceKey } from '../cdm/properties';
import type { DocumentFile } from '../domain/asset360Types';
import { formatDateTime, formatDocumentType } from '../domain/format';
import type { Asset360ViewModel } from '../hooks/useAsset360ViewModel';

import { PanelBody } from './PanelState';

export function DocumentsPanel({ viewModel }: { viewModel: Asset360ViewModel }) {
  const { openDocument, openingDocumentKey } = viewModel;
  const columns = useMemo(
    () => documentColumns({ openDocument, openingDocumentKey }),
    [openDocument, openingDocumentKey]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Documents</h3>
        <p className="text-xs text-muted-foreground">Opens in a new tab using a short-lived CDF link.</p>
      </div>

      {viewModel.openDocumentErrorMessage !== undefined && (
        <Alert variant="error" alertStyle="strip" role="alert">
          <AlertDescription>{viewModel.openDocumentErrorMessage}</AlertDescription>
        </Alert>
      )}

      <PanelBody
        state={viewModel.documents}
        skeletonLabel="Loading documents"
        skeletonRows={5}
        isEmpty={(documents) => documents.length === 0}
        emptyTitle="No documents linked to this asset"
        emptyDescription="Nothing in CDF links a file to this asset, so there is no documentation to show."
      >
        {(documents) => (
          <DataGrid
            aria-label="Documents related to this asset"
            data={documents}
            columns={columns}
            getRowId={(document) => instanceKey(document.ref)}
            size="compact"
            enableSorting
          />
        )}
      </PanelBody>
    </div>
  );
}

type DocumentColumnDeps = {
  openDocument: (document: DocumentFile) => void;
  openingDocumentKey: string | undefined;
};

function documentColumns({ openDocument, openingDocumentKey }: DocumentColumnDeps): ColumnDef<DocumentFile>[] {
  return [
    {
      id: 'name',
      header: 'Document',
      accessorFn: (document) => document.label,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.original.label}</span>
          {row.original.description !== undefined && (
            <span className="truncate text-xs text-muted-foreground">{row.original.description}</span>
          )}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      accessorFn: (document) => formatDocumentType(document.mimeType, document.name),
      size: 96,
      cell: ({ row }) => (
        <Badge variant="gray" outline>
          {formatDocumentType(row.original.mimeType, row.original.name)}
        </Badge>
      ),
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      accessorFn: (document) => document.uploadedTime ?? null,
      size: 168,
      cell: ({ row }) =>
        row.original.isUploaded ? (
          <span className="tabular-nums">{formatDateTime(row.original.uploadedTime)}</span>
        ) : (
          <span className="text-muted-foreground">Not uploaded</span>
        ),
    },
    {
      id: 'open',
      header: 'Action',
      enableSorting: false,
      size: 112,
      cell: ({ row }) => <OpenDocumentButton
        document={row.original}
        isOpening={openingDocumentKey === instanceKey(row.original.ref)}
        onOpen={openDocument}
      />,
    },
  ];
}

function OpenDocumentButton({
  document,
  isOpening,
  onOpen,
}: {
  document: DocumentFile;
  isOpening: boolean;
  onOpen: (document: DocumentFile) => void;
}) {
  // No content exists to fetch until the file has been uploaded to CDF.
  if (!document.isUploaded) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="sm" disabled aria-label={`Cannot open ${document.label}`}>
              Open
            </Button>
          }
        />
        <TooltipContent>This file has no content uploaded to CDF yet.</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onOpen(document)}
      disabled={isOpening}
      aria-label={`Open ${document.label} in a new tab`}
    >
      {isOpening ? 'Opening…' : 'Open'}
      <IconExternalLink aria-hidden className="size-4" />
    </Button>
  );
}
