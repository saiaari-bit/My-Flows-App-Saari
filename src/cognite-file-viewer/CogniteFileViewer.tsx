import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { pdfjs } from 'react-pdf';

import { DefaultError, DefaultLoading, DefaultUnsupported } from './fallbackViews';
import { ImageRenderer } from './ImageRenderer';
import { getViewerType } from './mimeTypes';
import { PdfRenderer } from './PdfRenderer';
import { TextRenderer } from './TextRenderer';
import type { CogniteFileViewerProps } from './types';
import { useFileResolver } from './useFileResolver';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export function CogniteFileViewer(props: CogniteFileViewerProps) {
  const {
    source,
    client,
    renderLoading,
    renderError,
    renderUnsupported,
    className,
    style,
  } = props;

  const {
    url,
    mimeType,
    instanceId,
    isLoading,
    error,
  } = useFileResolver(source, client);

  const viewerType = getViewerType(mimeType);
  const rotation = props.rotation ?? 0;

  if (isLoading) {
    return (
      <div className={className} style={style}>
        {renderLoading ? renderLoading() : <DefaultLoading />}
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={className} style={style}>
        {renderError
          ? renderError(error ?? new Error('No URL resolved'))
          : <DefaultError error={error ?? new Error('No URL resolved')} />}
      </div>
    );
  }

  const renderContent = () => {
    switch (viewerType) {
      case 'pdf':
        return <PdfRenderer {...props} url={url} instanceId={instanceId} rotation={rotation} />;
      case 'image':
        return <ImageRenderer {...props} url={url} rotation={rotation} />;
      case 'text':
        return <TextRenderer url={url} />;
      default:
        return renderUnsupported ? renderUnsupported(mimeType) : <DefaultUnsupported mimeType={mimeType} />;
    }
  };

  return (
    <div className={className} style={style}>
      {renderContent()}
    </div>
  );
}
