import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useBlobUrl } from './useBlobUrl';

describe(useBlobUrl.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes a blob url after the content fetch succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['img']), { status: 200 }))
    );

    const { result } = renderHook(() => useBlobUrl('https://files.example.test/pump.png'));

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.blobUrl).toEqual(expect.stringContaining('blob:'));
    });
  });

  it('reports an error when the content fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 }))
    );

    const { result } = renderHook(() => useBlobUrl('https://files.example.test/pump.png'));

    await waitFor(() => {
      expect(result.current.blobUrl).toBeNull();
      expect(result.current.error?.message).toBe('HTTP 503');
    });
  });
});