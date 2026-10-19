import { useEffect, useRef, useState } from 'react';

/**
 * Fetches a signed file-content URL into a blob URL the renderers can display.
 * This is not a CDF API call; the URL was already issued by the download-link flow.
 */
export function useBlobUrl(url: string): { blobUrl: string | null; error: Error | null } {
  const [result, setResult] = useState<{
    sourceUrl: string;
    blobUrl: string | null;
    error: Error | null;
  }>({ sourceUrl: url, blobUrl: null, error: null });
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const newUrl = URL.createObjectURL(blob);
        objectUrlRef.current = newUrl;
        setResult({ sourceUrl: url, blobUrl: newUrl, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult({
          sourceUrl: url,
          blobUrl: null,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [url]);

  return result.sourceUrl === url
    ? { blobUrl: result.blobUrl, error: result.error }
    : { blobUrl: null, error: null };
}
