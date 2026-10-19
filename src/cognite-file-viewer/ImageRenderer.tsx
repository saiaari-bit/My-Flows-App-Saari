import { useCallback, useState, type SyntheticEvent } from 'react';

import { DefaultError, DefaultLoading } from './fallbackViews';
import type { CogniteFileViewerProps } from './types';
import { useBlobUrl } from './useBlobUrl';
import { computeBaseWidth, useViewport } from './useViewport';

interface ImageRendererProps
  extends Omit<CogniteFileViewerProps, 'source' | 'client' | 'className' | 'style'> {
  url: string;
}

export function ImageRenderer(props: ImageRendererProps) {
  const { url, rotation = 0, fitMode, width: explicitWidth, renderLoading, renderError, renderOverlay } = props;
  const { currentZoom, effectivePan, containerDims, viewportRef, cursor, handleMouseDown } =
    useViewport(props);

  const { blobUrl, error } = useBlobUrl(url);
  const [loadedImage, setLoadedImage] = useState<{
    sourceUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const naturalSize =
    loadedImage?.sourceUrl === url
      ? { width: loadedImage.width, height: loadedImage.height }
      : null;

  const handleLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    setLoadedImage({
      sourceUrl: url,
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  }, [url]);

  if (error) return renderError ? renderError(error) : <DefaultError error={error} />;
  if (!blobUrl) return renderLoading ? renderLoading() : <DefaultLoading />;

  const baseWidth = computeBaseWidth(fitMode, explicitWidth, containerDims, naturalSize);
  const imgWidth = baseWidth ?? naturalSize?.width;

  if (!imgWidth || !naturalSize) {
    return (
      <div ref={viewportRef} style={{ overflow: 'hidden' }}>
        {renderLoading ? renderLoading() : <DefaultLoading />}
        <img
          src={blobUrl}
          alt=""
          style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}
          onLoad={handleLoad}
        />
      </div>
    );
  }

  const imgHeight = imgWidth * (naturalSize.height / naturalSize.width);
  const isSwapped = rotation === 90 || rotation === 270;
  const visualW = (isSwapped ? imgHeight : imgWidth) * currentZoom;
  const visualH = (isSwapped ? imgWidth : imgHeight) * currentZoom;

  return (
    <div ref={viewportRef} style={{ overflow: currentZoom > 1 ? 'hidden' : 'auto', cursor }} onMouseDown={handleMouseDown}>
      <div
        style={{
          display: 'inline-block',
          transform:
            effectivePan.x !== 0 || effectivePan.y !== 0
              ? `translate(${effectivePan.x}px, ${effectivePan.y}px)`
              : undefined,
        }}
      >
        <div style={{ width: visualW, height: visualH, position: 'relative' }}>
          <img
            src={blobUrl}
            alt=""
            style={{
              position: 'absolute',
              width: imgWidth * currentZoom,
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }}
            onLoad={handleLoad}
          />
          {renderOverlay && naturalSize && (
            renderOverlay({
              width: visualW,
              height: visualH,
              originalWidth: naturalSize.width,
              originalHeight: naturalSize.height,
              pageNumber: 1,
              rotation,
            })
          )}
        </div>
      </div>
    </div>
  );
}
