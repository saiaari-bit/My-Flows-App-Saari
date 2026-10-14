import { useCogniteSdk } from '@cognite/app-sdk/react';
import { createContext, useContext, useMemo } from 'react';

import type { FileService, FileServiceClient } from './fileService';
import { CdmFileService } from './fileService';

export type FileServiceContextType = {
  useFileService: () => FileService;
  useCogniteSdk: () => FileServiceClient;
};

function useCdmFileService(): FileService {
  const { useCogniteSdk } = useContext(FileServiceContext);
  const client = useCogniteSdk();
  return useMemo(() => new CdmFileService(client), [client]);
}

export const DEFAULT_FILE_SERVICE_DEPS: FileServiceContextType = {
  useFileService: useCdmFileService,
  useCogniteSdk,
};

/** Shared injection seam for linked-file metadata and temporary URLs. */
export const FileServiceContext = createContext<FileServiceContextType>(
  DEFAULT_FILE_SERVICE_DEPS
);

export function useFileService(): FileService {
  const deps = useContext(FileServiceContext);
  return deps.useFileService();
}
