import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentAnnotationOverlay } from './DocumentAnnotationOverlay';
import type { DocumentAnnotation } from './types';

describe(DocumentAnnotationOverlay.name, () => {
  it('renders nothing when there are no annotations', () => {
    // Arrange / Act
    const { container } = render(
      <DocumentAnnotationOverlay annotations={[]} containerHeight={200} containerWidth={200} />
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the container has not been measured yet', () => {
    // Arrange / Act
    const { container } = render(
      <DocumentAnnotationOverlay
        annotations={[makeAnnotation({ id: 'a1' })]}
        containerHeight={0}
        containerWidth={0}
      />
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one rect per annotation at unrotated (0deg) coordinates', () => {
    // Arrange
    const annotation = makeAnnotation({ id: 'a1', x: 0.1, y: 0.2, width: 0.3, height: 0.4 });

    // Act
    const { container } = render(
      <DocumentAnnotationOverlay annotations={[annotation]} containerHeight={200} containerWidth={100} />
    );

    // Assert
    const rect = container.querySelector('rect');
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute('x')).toBe('10');
    expect(rect?.getAttribute('y')).toBe('40');
    expect(rect?.getAttribute('width')).toBe('30');
    expect(rect?.getAttribute('height')).toBe('80');
  });

  it.each([
    [90, { x: 30, y: 20, width: 40, height: 30 }],
    [180, { x: 50, y: 30, width: 30, height: 40 }],
    [270, { x: 30, y: 50, width: 40, height: 30 }],
  ] as const)('transforms annotation coordinates for a %sdeg rotation', (rotation, expected) => {
    // Arrange: containerWidth=100, containerHeight=100, annotation x=0.2 y=0.3 w=0.3 h=0.4
    const annotation = makeAnnotation({ id: 'a1', x: 0.2, y: 0.3, width: 0.3, height: 0.4 });

    // Act
    const { container } = render(
      <DocumentAnnotationOverlay
        annotations={[annotation]}
        containerHeight={100}
        containerWidth={100}
        rotation={rotation}
      />
    );

    // Assert
    const rect = container.querySelector('rect');
    expect(Number(rect?.getAttribute('x'))).toBeCloseTo(expected.x);
    expect(Number(rect?.getAttribute('y'))).toBeCloseTo(expected.y);
    expect(Number(rect?.getAttribute('width'))).toBeCloseTo(expected.width);
    expect(Number(rect?.getAttribute('height'))).toBeCloseTo(expected.height);
  });

  it('calls onAnnotationHover and highlights the rect on mouse enter, and clears on mouse leave', () => {
    // Arrange
    const onAnnotationHover = vi.fn();
    const annotation = makeAnnotation({ id: 'a1' });
    const { container } = render(
      <DocumentAnnotationOverlay
        annotations={[annotation]}
        containerHeight={200}
        containerWidth={200}
        onAnnotationHover={onAnnotationHover}
      />
    );
    const rect = container.querySelector('rect');
    if (!rect) throw new Error('Expected a rect element');
    expect(rect.getAttribute('fill')).toBe('none');

    // Act
    fireEvent.mouseEnter(rect);

    // Assert
    expect(onAnnotationHover).toHaveBeenCalledWith(annotation);
    expect(rect.getAttribute('fill')).not.toBe('none');
    expect(rect.getAttribute('stroke-width')).toBe('2');

    // Act
    fireEvent.mouseLeave(rect);

    // Assert
    expect(onAnnotationHover).toHaveBeenLastCalledWith(null);
    expect(rect.getAttribute('fill')).toBe('none');
  });

  it('calls onAnnotationClick and stops the click from bubbling to ancestors', () => {
    // Arrange
    const onAnnotationClick = vi.fn();
    const onWrapperClick = vi.fn();
    const annotation = makeAnnotation({ id: 'a1' });

    // Act
    const { container } = render(
      <div onClick={onWrapperClick}>
        <DocumentAnnotationOverlay
          annotations={[annotation]}
          containerHeight={200}
          containerWidth={200}
          onAnnotationClick={onAnnotationClick}
        />
      </div>
    );
    const rect = container.querySelector('rect');
    if (!rect) throw new Error('Expected a rect element');
    fireEvent.click(rect);

    // Assert
    expect(onAnnotationClick).toHaveBeenCalledWith(annotation);
    expect(onWrapperClick).not.toHaveBeenCalled();
  });

  it('renders a native <title> tooltip from annotation text when no custom renderer is given', () => {
    // Arrange
    const annotation = makeAnnotation({ id: 'a1', text: 'PUMP-001' });

    // Act
    const { container } = render(
      <DocumentAnnotationOverlay annotations={[annotation]} containerHeight={200} containerWidth={200} />
    );

    // Assert
    expect(container.querySelector('title')?.textContent).toBe('PUMP-001');
  });

  it('omits the native <title> when the annotation has no text', () => {
    // Arrange
    const annotation = makeAnnotation({ id: 'a1', text: undefined });

    // Act
    const { container } = render(
      <DocumentAnnotationOverlay annotations={[annotation]} containerHeight={200} containerWidth={200} />
    );

    // Assert
    expect(container.querySelector('title')).toBeNull();
  });

  it('renders a custom tooltip while hovered instead of the native title, with the pixel-space rect', () => {
    // Arrange
    const annotation = makeAnnotation({ id: 'a1', text: 'PUMP-001', x: 0, y: 0, width: 0.5, height: 0.5 });
    const renderAnnotationTooltip = vi.fn((a: DocumentAnnotation) => (
      <div data-testid="tooltip">{a.text}</div>
    ));
    const { container, queryByTestId } = render(
      <DocumentAnnotationOverlay
        annotations={[annotation]}
        containerHeight={200}
        containerWidth={200}
        renderAnnotationTooltip={renderAnnotationTooltip}
      />
    );

    // Assert: no tooltip before hover, and no native title rendered
    expect(queryByTestId('tooltip')).toBeNull();
    expect(container.querySelector('title')).toBeNull();

    // Act
    const rect = container.querySelector('rect');
    if (!rect) throw new Error('Expected a rect element');
    fireEvent.mouseEnter(rect);

    // Assert
    expect(queryByTestId('tooltip')).toHaveTextContent('PUMP-001');
    expect(renderAnnotationTooltip).toHaveBeenCalledWith(annotation, { x: 0, y: 0, width: 100, height: 100 });

    // Act: leaving removes the tooltip again
    fireEvent.mouseLeave(rect);
    expect(queryByTestId('tooltip')).toBeNull();
  });
});

function makeAnnotation(overrides: Partial<DocumentAnnotation> & { id: string }): DocumentAnnotation {
  return {
    x: 0,
    y: 0,
    width: 0.1,
    height: 0.1,
    page: 1,
    resourceType: 'asset',
    annotationType: 'diagrams.AssetLink',
    ...overrides,
  };
}
