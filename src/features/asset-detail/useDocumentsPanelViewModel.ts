import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type { InstanceRef } from '@/host/hostState';
import type { ServiceErrorKind } from '@/services/cdfError';
import { toCdfServiceError } from '@/services/cdfError';
import type { AssetFile } from '@/services/fileService';
import { useFileService } from '@/services/useFileService';

export type InlinePreviewType = 'pdf' | 'image' | 'unsupported';

export type DocumentsPanelViewModel = {
  status: 'loading' | 'ready' | 'error';
  files: AssetFile[];
  errorKind?: ServiceErrorKind;
  refresh: () => void;
  selectFile: (file: AssetFile) => void;
  closePreview: () => void;
  selectedFile?: AssetFile;
  previewType?: InlinePreviewType;
  previewUrl?: string;
  previewStatus: 'idle' | 'loading' | 'ready' | 'error';
  previewErrorKind?: ServiceErrorKind;
};

/**
 * File metadata is cached by asset identity. Download URLs are requested only
 * from `selectFile` and held only in this transient mutation. They are never
 * added to host-synced state, browser storage, or the query cache.
 */
export function useDocumentsPanelViewModel(
  assetId: InstanceRef
): DocumentsPanelViewModel {
  const service = useFileService();
  const { space, externalId } = assetId;

  const filesQuery = useQuery({
    queryKey: ['asset-files', space, externalId],
    queryFn: () => service.getAssetFiles({ space, externalId }),
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const previewMutation = useMutation({
    mutationKey: ['preview-file', space, externalId],
    retry: false,
    mutationFn: async (file: AssetFile) => {
      const previewType = getInlinePreviewType(file.mimeType);
      if (previewType === 'unsupported') {
        return { file, previewType };
      }
      const fileId = { space: file.space, externalId: file.externalId };
      const url = await service.getDownloadUrl(fileId);
      return { file, previewType, url };
    },
  });

  const refetch = filesQuery.refetch;
  const refresh = useCallback(() => void refetch(), [refetch]);
  const mutate = previewMutation.mutate;
  const selectFile = useCallback(
    (file: AssetFile) => mutate(file),
    [mutate]
  );
  const reset = previewMutation.reset;
  const closePreview = useCallback(() => reset(), [reset]);

  useEffect(() => {
    reset();
  }, [space, externalId, reset]);

  const status =
    filesQuery.status === 'pending'
      ? 'loading'
      : filesQuery.status === 'error'
        ? 'error'
        : 'ready';

  return useMemo(
    () => ({
      status,
      files: filesQuery.data ?? [],
      errorKind:
        filesQuery.error === null
          ? undefined
          : toCdfServiceError(filesQuery.error).kind,
      refresh,
      selectFile,
      closePreview,
      selectedFile: previewMutation.variables,
      previewType:
        previewMutation.variables === undefined
          ? undefined
          : getInlinePreviewType(previewMutation.variables.mimeType),
      previewUrl:
        previewMutation.status === 'success'
          ? previewMutation.data.url
          : undefined,
      previewStatus:
        previewMutation.status === 'pending'
          ? 'loading'
          : previewMutation.status === 'success'
            ? 'ready'
            : previewMutation.status,
      previewErrorKind:
        previewMutation.error === null
          ? undefined
          : toCdfServiceError(previewMutation.error).kind,
    }),
    [
      status,
      filesQuery.data,
      filesQuery.error,
      refresh,
      selectFile,
      closePreview,
      previewMutation.variables,
      previewMutation.status,
      previewMutation.data,
      previewMutation.error,
    ]
  );
}

export function getInlinePreviewType(
  mimeType: string | undefined
): InlinePreviewType {
  const normalized = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  if (normalized === 'application/pdf') return 'pdf';
  if (
    normalized === 'image/png' ||
    normalized === 'image/jpeg' ||
    normalized === 'image/gif' ||
    normalized === 'image/webp'
  ) {
    return 'image';
  }
  return 'unsupported';
}
