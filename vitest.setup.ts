import '@testing-library/jest-dom/vitest';

/**
 * happy-dom reports every element as 0x0. Aura's `DataGrid` virtualizes rows
 * with TanStack Virtual, which then decides nothing is visible and renders no
 * rows at all. Giving elements a viewport-sized box makes virtualized content
 * assertable in tests; it has no effect on the app itself.
 */
const VIEWPORT = { width: 1280, height: 900 };

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value(): DOMRect {
    const rect = {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: VIEWPORT.width,
      bottom: VIEWPORT.height,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    };
    return { ...rect, toJSON: () => rect };
  },
});

for (const [property, value] of [
  ['offsetWidth', VIEWPORT.width],
  ['offsetHeight', VIEWPORT.height],
  ['clientWidth', VIEWPORT.width],
  ['clientHeight', VIEWPORT.height],
] as const) {
  Object.defineProperty(HTMLElement.prototype, property, { configurable: true, value });
}
