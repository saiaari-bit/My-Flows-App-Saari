import type { CogniteClient } from '@cognite/sdk';
import { useState, useEffect, useRef } from 'react';

import { resolveFileDownloadConfig } from './fileResolution';
import { inferMimeTypeFromUrl } from './mimeTypes';
import type { FileSource, UseFileResolverResult } from './types';

const INITIAL: UseFileResolverResult = {
  isLoading: true,
  error: null,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Resolves a {@link FileSource} to a download URL and MIME type.
 *
 * - `url` sources are returned directly (no client needed).
 * - `internalId` and `instanceId` sources use the CogniteClient to fetch
 *   metadata and resolve a download URL (with caching).
 */
export function useFileResolver(
  source: FileSource,
  client?: CogniteClient,
): UseFileResolverResult {
  const [result, setResult] = useState<UseFileResolverResult>(INITIAL);
  const cancelRef = useRef(0);
  const sourceType = source.type;
  const sourceUrl = source.type === 'url' ? source.url : undefined;
  const sourceMimeType = source.type === 'url' ? source.mimeType : undefined;
  const sourceId = source.type === 'internalId' ? source.id : undefined;
  const sourceSpace = source.type === 'instanceId' ? source.space : undefined;
  const sourceExternalId =
    source.type === 'instanceId' ? source.externalId : undefined;

  useEffect(() => {
    const id = ++cancelRef.current;
    const cancelled = () => id !== cancelRef.current;

    async function resolve() {
      setResult(INITIAL);

      try {
        // ----- URL source: no client needed -----
        if (sourceType === 'url' && sourceUrl !== undefined) {
          const mimeType = sourceMimeType ?? inferMimeTypeFromUrl(sourceUrl);
          setResult({
            url: sourceUrl,
            mimeType: mimeType ?? '',
            isLoading: false,
            error: null,
          });
          return;
        }

        // ----- CDF sources: client is required -----
        if (!client) {
          throw new Error(
            'CogniteClient is required for instanceId and internalId sources',
          );
        }

        // Build the lookup identifier the SDK expects
        const idParam =
          sourceType === 'internalId' && sourceId !== undefined
            ? { id: sourceId }
            : sourceType === 'instanceId' &&
                sourceSpace !== undefined &&
                sourceExternalId !== undefined
              ? {
                  instanceId: {
                    space: sourceSpace,
                    externalId: sourceExternalId,
                  },
                }
              : undefined;
        if (idParam === undefined) throw new Error('Invalid CDF file source');

        const [fileInfo] = await client.files.retrieve([idParam]);
        if (cancelled()) return;

        const resolved = await resolveFileDownloadConfig(client, fileInfo);
        if (cancelled()) return;

        // Derive instanceId — prefer the one returned by the API,
        // fall back to what the caller passed for instanceId sources.
        const instanceId = fileInfo.instanceId
          ? {
              space: fileInfo.instanceId.space,
              externalId: fileInfo.instanceId.externalId,
            }
          : sourceType === 'instanceId' &&
              sourceSpace !== undefined &&
              sourceExternalId !== undefined
            ? { space: sourceSpace, externalId: sourceExternalId }
            : undefined;

        setResult({
          url: resolved.url,
          mimeType: resolved.mimeType,
          fileInfo,
          instanceId,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled()) return;
        setResult({
          isLoading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    resolve();
  }, [
    client,
    sourceExternalId,
    sourceId,
    sourceMimeType,
    sourceSpace,
    sourceType,
    sourceUrl,
  ]);

  return result;
}
