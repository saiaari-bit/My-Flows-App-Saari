import { vi } from 'vitest';

import type { AssetFile, FileService } from '@/services/fileService';

export function createFileServiceStub() {
  return {
    getAssetFiles: vi.fn<FileService['getAssetFiles']>(() => Promise.resolve([])),
    getDownloadUrl: vi.fn<FileService['getDownloadUrl']>(() =>
      Promise.resolve('https://files.example.test/download')
    ),
  };
}

export type FileServiceStub = ReturnType<typeof createFileServiceStub>;

export function makeFile(
  externalId: string,
  overrides: Partial<AssetFile> = {}
): AssetFile {
  return { space: 'my-space', externalId, isUploaded: true, ...overrides };
}
