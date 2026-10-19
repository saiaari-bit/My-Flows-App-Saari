import { act, renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { computeBaseWidth, useViewport } from './useViewport';

describe(computeBaseWidth.name, () => {
  it('returns the explicit width when there is no fit mode', () => {
    expect(computeBaseWidth(undefined, 400, { width: 800, height: 600 }, null)).toBe(400);
  });

  it('returns the explicit width when the container has not been measured yet', () => {
    expect(computeBaseWidth('width', 400, { width: 0, height: 0 }, null)).toBe(400);
  });

  it('fits to the container width in "width" mode', () => {
    expect(computeBaseWidth('width', 400, { width: 800, height: 600 }, null)).toBe(800);
  });

  it('falls back to the explicit width in "page" mode without a natural size', () => {
    expect(computeBaseWidth('page', 400, { width: 800, height: 600 }, null)).toBe(400);
  });

  it('falls back to the explicit width in "page" mode when natural height is zero', () => {
    expect(
      computeBaseWidth('page', 400, { width: 800, height: 600 }, { width: 100, height: 0 })
    ).toBe(400);
  });

  it('falls back to the explicit width in "page" mode when container height is zero', () => {
    expect(
      computeBaseWidth('page', 400, { width: 800, height: 0 }, { width: 100, height: 200 })
    ).toBe(400);
  });

  it('fits the full page height when the container is relatively wider than the page', () => {
    // container aspect (800/300 ≈ 2.67) > page aspect (100/200 = 0.5)
    const result = computeBaseWidth('page', 400, { width: 800, height: 300 }, { width: 100, height: 200 });
    expect(result).toBeCloseTo(300 * 0.5);
  });

  it('fits the full container width when the page is relatively wider than the container', () => {
    // container aspect (300/800 = 0.375) <= page aspect (200/100 = 2)
    const result = computeBaseWidth('page', 400, { width: 300, height: 800 }, { width: 200, height: 100 });
    expect(result).toBe(300);
  });
});

describe(useViewport.name, () => {
  it('starts unzoomed, unpanned, and with default cursor', () => {
    // Arrange / Act
    const { result } = renderHook(() => useViewport({}));

    // Assert
    expect(result.current.currentZoom).toBe(1);
    expect(result.current.effectivePan).toEqual({ x: 0, y: 0 });
    expect(result.current.containerDims).toEqual({ width: 0, height: 0 });
    expect(result.current.cursor).toBe('default');
  });

  it('uses the controlled zoom value when provided', () => {
    // Arrange / Act
    const { result } = renderHook(() => useViewport({ zoom: 2.5 }));

    // Assert
    expect(result.current.currentZoom).toBe(2.5);
  });

  it('clamps zoom changes between minZoom and maxZoom', () => {
    // Arrange
    const onZoomChange = vi.fn();
    const { result } = renderHook(() => useViewport({ minZoom: 0.5, maxZoom: 2, onZoomChange }));

    // Act
    act(() => result.current.handleZoomChange(10));

    // Assert
    expect(onZoomChange).toHaveBeenCalledWith(2);
  });

  it('clamps zoom changes below the minimum', () => {
    // Arrange
    const onZoomChange = vi.fn();
    const { result } = renderHook(() => useViewport({ minZoom: 0.5, maxZoom: 2, onZoomChange }));

    // Act
    act(() => result.current.handleZoomChange(0.01));

    // Assert
    expect(onZoomChange).toHaveBeenCalledWith(0.5);
  });

  it('updates internal zoom when uncontrolled', () => {
    // Arrange
    const { result } = renderHook(() => useViewport({}));

    // Act
    act(() => result.current.handleZoomChange(2));

    // Assert
    expect(result.current.currentZoom).toBe(2);
  });

  it('reports pan as zero while zoom is at or below 1x, even if pan was set', () => {
    // Arrange
    const { result } = renderHook(() => useViewport({}));

    // Act
    act(() => result.current.handlePanChange({ x: 50, y: 50 }));

    // Assert: zoom is still 1, so effectivePan collapses to zero
    expect(result.current.effectivePan).toEqual({ x: 0, y: 0 });
  });

  it('reports the controlled pan once zoomed in', () => {
    // Arrange
    const onPanChange = vi.fn();
    const { result } = renderHook(() =>
      useViewport({ zoom: 2, panOffset: { x: 30, y: 40 }, onPanChange })
    );

    // Assert
    expect(result.current.effectivePan).toEqual({ x: 30, y: 40 });
  });

  it('calls onPanChange with the new offset when uncontrolled and zoomed in', () => {
    // Arrange
    const onPanChange = vi.fn();
    const { result } = renderHook(() => useViewport({ zoom: 2, onPanChange }));

    // Act
    act(() => result.current.handlePanChange({ x: 10, y: 20 }));

    // Assert
    expect(onPanChange).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(result.current.effectivePan).toEqual({ x: 10, y: 20 });
  });

  it('shows a grab cursor when zoomed in and not dragging', () => {
    const { result } = renderHook(() => useViewport({ zoom: 1.5 }));
    expect(result.current.cursor).toBe('grab');
  });

  it('measures the container element on mount via viewportRef', () => {
    // Arrange
    const { result } = renderHook(() => useViewport({}));
    const div = document.createElement('div');
    Object.defineProperty(div, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(div, 'clientHeight', { value: 480, configurable: true });

    // Act
    act(() => result.current.viewportRef(div));

    // Assert
    expect(result.current.containerDims).toEqual({ width: 640, height: 480 });
  });

  it('re-measures when a new node replaces the old one, disconnecting the previous observer', () => {
    // Arrange
    const { result } = renderHook(() => useViewport({}));
    const first = document.createElement('div');
    Object.defineProperty(first, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(first, 'clientHeight', { value: 100, configurable: true });
    act(() => result.current.viewportRef(first));

    const second = document.createElement('div');
    Object.defineProperty(second, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(second, 'clientHeight', { value: 150, configurable: true });

    // Act
    act(() => result.current.viewportRef(second));

    // Assert
    expect(result.current.containerDims).toEqual({ width: 200, height: 150 });
  });

  it('detaches cleanly when the ref callback receives null', () => {
    // Arrange
    const { result } = renderHook(() => useViewport({}));
    const div = document.createElement('div');
    act(() => result.current.viewportRef(div));

    // Act / Assert: no throw on detach
    expect(() => act(() => result.current.viewportRef(null))).not.toThrow();
  });

  it('zooms toward the cursor on ctrl+wheel and adjusts pan to compensate', () => {
    // Arrange
    const onZoomChange = vi.fn();
    const onPanChange = vi.fn();
    const { result } = renderHook(() => useViewport({ onZoomChange, onPanChange }));
    const div = document.createElement('div');
    act(() => result.current.viewportRef(div));

    // Act: dispatch a synthetic wheel event. happy-dom's WheelEvent constructor
    // does not propagate ctrlKey/metaKey, so a plain Event carries the fields
    // the handler actually reads.
    const wheelEvent = Object.assign(new Event('wheel', { cancelable: true, bubbles: true }), {
      ctrlKey: true,
      deltaY: -10,
      clientX: 50,
      clientY: 50,
    });
    act(() => {
      div.dispatchEvent(wheelEvent);
    });

    // Assert
    expect(onZoomChange).toHaveBeenCalledWith(1.1);
    expect(onPanChange).toHaveBeenCalled();
  });

  it('does not change zoom or pan on ctrl+wheel once already clamped at maxZoom', () => {
    // Arrange
    const onZoomChange = vi.fn();
    const onPanChange = vi.fn();
    const { result } = renderHook(() => useViewport({ zoom: 5, maxZoom: 5, onZoomChange, onPanChange }));
    const div = document.createElement('div');
    act(() => result.current.viewportRef(div));

    // Act
    const wheelEvent = Object.assign(new Event('wheel', { cancelable: true, bubbles: true }), {
      ctrlKey: true,
      deltaY: -10,
      clientX: 0,
      clientY: 0,
    });
    act(() => {
      div.dispatchEvent(wheelEvent);
    });

    // Assert: newZoom === oldZoom (both clamped to 5), so nothing fires
    expect(onZoomChange).not.toHaveBeenCalled();
    expect(onPanChange).not.toHaveBeenCalled();
  });

  it('pans on plain wheel scroll once zoomed in', () => {
    // Arrange
    const onPanChange = vi.fn();
    const { result } = renderHook(() => useViewport({ zoom: 2, onPanChange }));
    const div = document.createElement('div');
    act(() => result.current.viewportRef(div));

    // Act
    const wheelEvent = Object.assign(new Event('wheel', { cancelable: true, bubbles: true }), {
      ctrlKey: false,
      deltaX: 5,
      deltaY: 15,
    });
    act(() => {
      div.dispatchEvent(wheelEvent);
    });

    // Assert
    expect(onPanChange).toHaveBeenCalledWith({ x: -5, y: -15 });
  });

  it('ignores plain wheel scroll while not zoomed in', () => {
    // Arrange
    const onPanChange = vi.fn();
    const { result } = renderHook(() => useViewport({ zoom: 1, onPanChange }));
    const div = document.createElement('div');
    act(() => result.current.viewportRef(div));

    // Act
    const wheelEvent = Object.assign(new Event('wheel', { cancelable: true, bubbles: true }), {
      ctrlKey: false,
      deltaX: 5,
      deltaY: 15,
    });
    act(() => {
      div.dispatchEvent(wheelEvent);
    });

    // Assert
    expect(onPanChange).not.toHaveBeenCalled();
  });

  it('pinch-zooms and pans toward the pinch center on a two-finger touch gesture', () => {
    // Arrange
    const onZoomChange = vi.fn();
    const onPanChange = vi.fn();
    const { result } = renderHook(() => useViewport({ onZoomChange, onPanChange }));
    const div = document.createElement('div');
    act(() => result.current.viewportRef(div));

    // Act: start with two fingers 100px apart, then pinch outward to 200px apart
    const startT1 = new Touch({ identifier: 1, target: div, clientX: 0, clientY: 0 });
    const startT2 = new Touch({ identifier: 2, target: div, clientX: 100, clientY: 0 });
    act(() => {
      div.dispatchEvent(
        new TouchEvent('touchstart', { touches: [startT1, startT2], cancelable: true, bubbles: true })
      );
    });

    const moveT1 = new Touch({ identifier: 1, target: div, clientX: -50, clientY: 0 });
    const moveT2 = new Touch({ identifier: 2, target: div, clientX: 150, clientY: 0 });
    act(() => {
      div.dispatchEvent(
        new TouchEvent('touchmove', { touches: [moveT1, moveT2], cancelable: true, bubbles: true })
      );
    });

    // Assert: distance doubled (100 -> 200), so zoom scales by 2x
    expect(onZoomChange).toHaveBeenCalledWith(2);
    expect(onPanChange).toHaveBeenCalled();

    // Act: lifting fingers ends the gesture; a further move is a no-op
    act(() => {
      div.dispatchEvent(new Event('touchend', { bubbles: true }));
    });
    onZoomChange.mockClear();
    act(() => {
      div.dispatchEvent(
        new TouchEvent('touchmove', { touches: [moveT1, moveT2], cancelable: true, bubbles: true })
      );
    });
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it('ignores single-finger touch start and move (not a pinch gesture)', () => {
    // Arrange
    const onZoomChange = vi.fn();
    const { result } = renderHook(() => useViewport({ onZoomChange }));
    const div = document.createElement('div');
    act(() => result.current.viewportRef(div));
    const t1 = new Touch({ identifier: 1, target: div, clientX: 0, clientY: 0 });

    // Act
    act(() => {
      div.dispatchEvent(new TouchEvent('touchstart', { touches: [t1], cancelable: true, bubbles: true }));
      div.dispatchEvent(new TouchEvent('touchmove', { touches: [t1], cancelable: true, bubbles: true }));
    });

    // Assert
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it('cancels an in-progress pinch on touchcancel', () => {
    // Arrange
    const onZoomChange = vi.fn();
    const { result } = renderHook(() => useViewport({ onZoomChange }));
    const div = document.createElement('div');
    act(() => result.current.viewportRef(div));
    const t1 = new Touch({ identifier: 1, target: div, clientX: 0, clientY: 0 });
    const t2 = new Touch({ identifier: 2, target: div, clientX: 100, clientY: 0 });
    act(() => {
      div.dispatchEvent(new TouchEvent('touchstart', { touches: [t1, t2], cancelable: true, bubbles: true }));
      div.dispatchEvent(new Event('touchcancel', { bubbles: true }));
    });

    // Act: further move after cancel should be ignored
    act(() => {
      div.dispatchEvent(new TouchEvent('touchmove', { touches: [t1, t2], cancelable: true, bubbles: true }));
    });

    // Assert
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it('starts a middle-click drag when zoomed in and pans on mouse move', () => {
    // Arrange
    const onPanChange = vi.fn();
    const { result } = renderHook(() => useViewport({ zoom: 2, onPanChange }));

    // Act
    act(() => {
      result.current.handleMouseDown(makeMouseEvent({ button: 1, clientX: 100, clientY: 100 }));
    });

    // Assert
    expect(result.current.cursor).toBe('grabbing');

    // Act: move the mouse, then release
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 130, clientY: 90 }));
    });
    expect(onPanChange).toHaveBeenCalledWith({ x: 30, y: -10 });

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.cursor).toBe('grab');
  });

  it('ignores a middle-click drag start when not zoomed in', () => {
    // Arrange
    const { result } = renderHook(() => useViewport({ zoom: 1 }));

    // Act
    act(() => {
      result.current.handleMouseDown(makeMouseEvent({ button: 1, clientX: 0, clientY: 0 }));
    });

    // Assert
    expect(result.current.cursor).toBe('default');
  });

  it('ignores a non-middle-click even when zoomed in', () => {
    // Arrange
    const { result } = renderHook(() => useViewport({ zoom: 2 }));

    // Act
    act(() => {
      result.current.handleMouseDown(makeMouseEvent({ button: 0, clientX: 0, clientY: 0 }));
    });

    // Assert
    expect(result.current.cursor).toBe('grab');
  });

  it('cleans up event listeners and the resize observer on unmount', () => {
    // Arrange
    const { result, unmount } = renderHook(() => useViewport({}));
    const div = document.createElement('div');
    const removeEventListenerSpy = vi.spyOn(div, 'removeEventListener');
    act(() => result.current.viewportRef(div));

    // Act
    unmount();

    // Assert
    expect(removeEventListenerSpy).toHaveBeenCalled();
  });
});

function makeMouseEvent(overrides: {
  button: number;
  clientX: number;
  clientY: number;
}): ReactMouseEvent {
  return {
    ...overrides,
    preventDefault: () => undefined,
  } as Partial<ReactMouseEvent> as ReactMouseEvent;
}
