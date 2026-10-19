import type { EdgeDefinition } from '@cognite/sdk';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearAnnotationCache, useDocumentAnnotations } from './useDocumentAnnotations';

import { createCogniteClientStub } from '@/__mocks__/cogniteClient';

beforeEach(() => {
  // Annotations are cached per project/space/externalId in a module-level
  // Map, so every test starts from a clean slate.
  clearAnnotationCache();
});

describe(useDocumentAnnotations.name, () => {
  it('returns an empty, non-loading result when no client is provided', () => {
    // Arrange / Act
    const { result } = renderHook(() =>
      useDocumentAnnotations(undefined, { space: 's', externalId: 'e' })
    );

    // Assert
    expect(result.current).toEqual({ annotations: [], isLoading: false, error: null });
  });

  it('returns an empty result when no instanceId is provided', () => {
    // Arrange
    const { client } = createCogniteClientStub();

    // Act
    const { result } = renderHook(() => useDocumentAnnotations(client, undefined));

    // Assert
    expect(result.current).toEqual({ annotations: [], isLoading: false, error: null });
    expect(client).toBeDefined();
  });

  it('does not query when disabled, even with a valid client and instanceId', () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();

    // Act
    const { result } = renderHook(() =>
      useDocumentAnnotations(client, { space: 's', externalId: 'e' }, 1, { enabled: false })
    );

    // Assert
    expect(result.current).toEqual({ annotations: [], isLoading: false, error: null });
    expect(instancesQuery).not.toHaveBeenCalled();
  });

  it('fetches, classifies, and filters annotations by the current page', async () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();
    instancesQuery.mockResolvedValue({
      items: {
        annotations: [
          makeEdge({
            key: 'a1',
            typeExternalId: 'diagrams.AssetLink',
            props: { startNodePageNumber: 1, startNodeXMin: 0.1, startNodeXMax: 0.2, startNodeYMin: 0.1, startNodeYMax: 0.2 },
            endNode: { space: 'assets', externalId: 'PUMP-1' },
          }),
          makeEdge({
            key: 'a2',
            typeExternalId: 'diagrams.FileLink',
            props: { startNodePageNumber: 2 },
          }),
          makeEdge({
            key: 'a3',
            typeExternalId: 'SomeTimeSeriesLink',
            props: { startNodePageNumber: 1 },
          }),
          makeEdge({
            key: 'a4',
            typeExternalId: 'SequenceThing',
            props: { startNodePageNumber: 1 },
          }),
          makeEdge({
            key: 'a5',
            typeExternalId: 'EventThing',
            props: { startNodePageNumber: 1 },
          }),
          makeEdge({
            key: 'a6',
            typeExternalId: 'DiagramConnection',
            props: { startNodePageNumber: 1 },
          }),
          makeEdge({
            key: 'a7',
            typeExternalId: 'SomethingElse',
            props: { startNodePageNumber: 1 },
          }),
          makeEdge({
            key: 'rejected',
            typeExternalId: 'diagrams.AssetLink',
            props: { startNodePageNumber: 1, status: 'Rejected' },
          }),
          // No CDM properties at all -> filtered out
          { ...makeEdge({ key: 'no-props', typeExternalId: 'x', props: { startNodePageNumber: 1 } }), properties: undefined },
          // A non-edge item mixed into the response -> filtered out
          { instanceType: 'node' },
        ],
      },
      nextCursor: {},
    });

    // Act
    const { result } = renderHook(() =>
      useDocumentAnnotations(client, { space: 's', externalId: 'e' }, 1)
    );

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    const byId = Object.fromEntries(result.current.annotations.map((a) => [a.id.slice(-2), a]));
    expect(Object.keys(byId).sort()).toEqual(['a1', 'a3', 'a4', 'a5', 'a6', 'a7']);
    expect(byId.a1?.resourceType).toBe('asset');
    expect(byId.a1?.linkedResource).toEqual({ space: 'assets', externalId: 'PUMP-1' });
    expect(byId.a3?.resourceType).toBe('timeSeries');
    expect(byId.a4?.resourceType).toBe('sequence');
    expect(byId.a5?.resourceType).toBe('event');
    expect(byId.a6?.resourceType).toBe('diagram');
    expect(byId.a7?.resourceType).toBe('unknown');
    expect(byId.a1?.x).toBeCloseTo(0.1);
    expect(byId.a1?.width).toBeCloseTo(0.1);
  });

  it('reports the file-type annotation when no explicit edge type is set', async () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();
    const edge = makeEdge({ key: 'default', typeExternalId: 'diagrams.FileLink', props: { startNodePageNumber: 1 } });
    instancesQuery.mockResolvedValue({
      items: { annotations: [{ ...edge, type: undefined }] },
      nextCursor: {},
    });

    // Act
    const { result } = renderHook(() =>
      useDocumentAnnotations(client, { space: 's', externalId: 'e' }, 1)
    );

    // Assert: falls back to 'diagrams.AssetLink' -> classified as 'asset'
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.annotations).toHaveLength(1);
    expect(result.current.annotations[0]?.resourceType).toBe('asset');
    expect(result.current.annotations[0]?.annotationType).toBe('diagrams.AssetLink');
  });

  it('paginates when a page of results reaches the query limit', async () => {
    // Arrange: first page is exactly QUERY_LIMIT (10,000) items with a cursor,
    // second page is short and ends the loop.
    const { client, instancesQuery } = createCogniteClientStub();
    const fullPage = Array.from({ length: 10_000 }, (_, i) =>
      makeEdge({ key: `p1-${i}`, typeExternalId: 'diagrams.AssetLink', props: { startNodePageNumber: 1 } })
    );
    const shortPage = [
      makeEdge({ key: 'p2-0', typeExternalId: 'diagrams.AssetLink', props: { startNodePageNumber: 1 } }),
    ];
    instancesQuery
      .mockResolvedValueOnce({
        items: { annotations: fullPage },
        nextCursor: { annotations: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        items: { annotations: shortPage },
        nextCursor: {},
      });

    // Act
    const { result } = renderHook(() =>
      useDocumentAnnotations(client, { space: 's', externalId: 'e' }, 1)
    );

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(instancesQuery).toHaveBeenCalledTimes(2);
    expect(instancesQuery.mock.calls[1]?.[0]?.cursors).toEqual({ annotations: 'cursor-1' });
    expect(result.current.annotations).toHaveLength(10_001);
  });

  it('surfaces an error when the query fails', async () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();
    instancesQuery.mockRejectedValue(new Error('query failed'));

    // Act
    const { result } = renderHook(() =>
      useDocumentAnnotations(client, { space: 's', externalId: 'e' }, 1)
    );

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('query failed');
    expect(result.current.annotations).toEqual([]);
  });

  it('wraps a non-Error rejection in an Error', async () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();
    instancesQuery.mockRejectedValue('plain string failure');

    // Act
    const { result } = renderHook(() =>
      useDocumentAnnotations(client, { space: 's', externalId: 'e' }, 1)
    );

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('plain string failure');
  });

  it('serves a second request for the same file from cache without re-querying', async () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();
    instancesQuery.mockResolvedValue({
      items: {
        annotations: [makeEdge({ key: 'a1', typeExternalId: 'diagrams.AssetLink', props: { startNodePageNumber: 1 } })],
      },
      nextCursor: {},
    });
    const instanceId = { space: 's', externalId: 'e' };
    const first = renderHook(() => useDocumentAnnotations(client, instanceId, 1));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));

    // Act
    const second = renderHook(() => useDocumentAnnotations(client, instanceId, 1));

    // Assert
    await waitFor(() => expect(second.result.current.annotations).toHaveLength(1));
    expect(instancesQuery).toHaveBeenCalledTimes(1);
  });

  it('re-queries after clearAnnotationCache invalidates the cache', async () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();
    instancesQuery.mockResolvedValue({ items: { annotations: [] }, nextCursor: {} });
    const instanceId = { space: 's', externalId: 'e' };
    const first = renderHook(() => useDocumentAnnotations(client, instanceId, 1));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));

    // Act
    clearAnnotationCache();
    const second = renderHook(() => useDocumentAnnotations(client, instanceId, 1));
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));

    // Assert
    expect(instancesQuery).toHaveBeenCalledTimes(2);
  });

  it('hides previously loaded annotations once disabled, without discarding the cache', async () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();
    instancesQuery.mockResolvedValue({
      items: {
        annotations: [makeEdge({ key: 'a1', typeExternalId: 'diagrams.AssetLink', props: { startNodePageNumber: 1 } })],
      },
      nextCursor: {},
    });
    const instanceId = { space: 's', externalId: 'e' };
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useDocumentAnnotations(client, instanceId, 1, { enabled }),
      { initialProps: { enabled: true } }
    );
    await waitFor(() => expect(result.current.annotations).toHaveLength(1));

    // Act
    rerender({ enabled: false });

    // Assert
    expect(result.current).toEqual({ annotations: [], isLoading: false, error: null });
  });

  it('re-filters cached annotations when only the current page changes', async () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();
    instancesQuery.mockResolvedValue({
      items: {
        annotations: [
          makeEdge({ key: 'p1', typeExternalId: 'diagrams.AssetLink', props: { startNodePageNumber: 1 } }),
          makeEdge({ key: 'p2', typeExternalId: 'diagrams.AssetLink', props: { startNodePageNumber: 2 } }),
        ],
      },
      nextCursor: {},
    });
    const instanceId = { space: 's', externalId: 'e' };
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) => useDocumentAnnotations(client, instanceId, page),
      { initialProps: { page: 1 } }
    );
    await waitFor(() => expect(result.current.annotations).toHaveLength(1));
    expect(result.current.annotations[0]?.id.endsWith('p1')).toBe(true);

    // Act
    rerender({ page: 2 });

    // Assert
    await waitFor(() => expect(result.current.annotations[0]?.id.endsWith('p2')).toBe(true));
    expect(instancesQuery).toHaveBeenCalledTimes(1);
  });

  it('defaults the current page to 1 when omitted', async () => {
    // Arrange
    const { client, instancesQuery } = createCogniteClientStub();
    instancesQuery.mockResolvedValue({
      items: {
        annotations: [makeEdge({ key: 'p1', typeExternalId: 'diagrams.AssetLink', props: { startNodePageNumber: 1 } })],
      },
      nextCursor: {},
    });

    // Act
    const { result } = renderHook(() => useDocumentAnnotations(client, { space: 's', externalId: 'e' }));

    // Assert
    await waitFor(() => expect(result.current.annotations).toHaveLength(1));
  });
});

describe(clearAnnotationCache.name, () => {
  it('is safe to call when no annotations have been cached', () => {
    expect(() => clearAnnotationCache()).not.toThrow();
  });
});

function makeEdge(options: {
  key: string;
  typeExternalId?: string;
  props: {
    status?: string;
    startNodeText?: string;
    startNodePageNumber?: number;
    startNodeXMin?: number;
    startNodeXMax?: number;
    startNodeYMin?: number;
    startNodeYMax?: number;
  };
  endNode?: { space: string; externalId: string };
}): EdgeDefinition {
  return {
    instanceType: 'edge',
    space: 's',
    externalId: options.key,
    type: options.typeExternalId
      ? { space: 'cdf_cdm', externalId: options.typeExternalId }
      : undefined,
    startNode: { space: 's', externalId: 'file' },
    endNode: options.endNode,
    properties: {
      cdf_cdm: {
        'CogniteDiagramAnnotation/v1': options.props,
      },
    },
  } as Partial<EdgeDefinition> as EdgeDefinition;
}
