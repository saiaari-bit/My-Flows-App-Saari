import { createContext } from 'react';
import type { ComponentType } from 'react';

import { CogniteFileViewer } from '@/cognite-file-viewer';
import type { CogniteFileViewerProps } from '@/cognite-file-viewer';

export type DocumentsPanelDeps = {
  FileViewer: ComponentType<CogniteFileViewerProps>;
};

export const DEFAULT_DOCUMENTS_PANEL_DEPS: DocumentsPanelDeps = {
  FileViewer: CogniteFileViewer,
};

export const DocumentsPanelContext = createContext<DocumentsPanelDeps>(
  DEFAULT_DOCUMENTS_PANEL_DEPS
);
