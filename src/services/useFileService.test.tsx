import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CdfPostOptions, InstanceListParams, InstanceListResponse } from './cdm';
import type { FileServiceClient } from './fileService';
import {
  DEFAULT_FILE_SERVICE_DEPS,
  FileServiceContext,
  useFileService,
} from './useFileService';

import { createFileServiceStub } from '@/__mocks__/fileService';

describe(useFileService.name, () => {
  it('builds and memoizes a CDM service from the injected SDK client', async () => {
    const client = makeClient();
    const { result, rerender } = renderHook(() => useFileService(), {
      wrapper: makeWrapper({ useCogniteSdk: () => client }),
    });
    const first = result.current;

    await result.current.getAssetFiles({ space: 'sp', externalId: 'PUMP-1' });
    rerender();

    expect(client.instances.list).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(first);
  });

  it('returns the service supplied through the context', () => {
    const stub = createFileServiceStub();

    const { result } = renderHook(() => useFileService(), {
      wrapper: makeWrapper({ useFileService: () => stub }),
    });

    expect(result.current).toBe(stub);
  });
});

function makeWrapper(overrides: Partial<typeof DEFAULT_FILE_SERVICE_DEPS>) {
  const value = { ...DEFAULT_FILE_SERVICE_DEPS, ...overrides };
  return function Wrapper({ children }: { children: ReactNode }) {
    return <FileServiceContext.Provider value={value}>{children}</FileServiceContext.Provider>;
  };
}

function makeClient(): FileServiceClient {
  const list = vi.fn(
    (_params: InstanceListParams): Promise<InstanceListResponse> =>
      Promise.resolve({ items: [] })
  );
  const post = vi.fn((_path: string, _options?: CdfPostOptions) =>
    Promise.resolve({ data: { items: [] } })
  );
  return { project: 'test-project', instances: { list }, post };
}
