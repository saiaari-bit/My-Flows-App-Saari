import { Asset360Error } from '../services/asset360Service';

const FALLBACK = 'Something went wrong while loading this information.';

/**
 * Turns a thrown value into copy that is safe to render.
 *
 * Only `Asset360Error` messages are shown, because those are written for the
 * analyst. Anything else becomes a generic sentence; the underlying error has
 * already been logged where it was raised.
 */
export function errorMessageOf(error: unknown): string | undefined {
  if (error === null || error === undefined) {
    return undefined;
  }
  if (error instanceof Asset360Error) {
    return error.message;
  }
  console.error('Asset 360: unexpected error surfaced to the UI', error);
  return FALLBACK;
}
