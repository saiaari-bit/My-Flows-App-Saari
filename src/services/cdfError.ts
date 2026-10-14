import { CogniteError, HttpError } from '@cognite/sdk';

/**
 * How a panel should react to a failed CDF read (SPEC.md FR-016, CL-006).
 *
 * - `no-access` — the user lacks a capability; retrying changes nothing.
 * - `transient` — timeout / throttling / server fault; the panel's manual
 *   refresh (FR-009) is worth offering. Services never retry on their own,
 *   because FR-010 forbids traffic the user did not ask for.
 * - `unknown` — everything else, including network and CORS failures that
 *   carry no HTTP status at all.
 */
export type ServiceErrorKind = 'no-access' | 'transient' | 'unknown';

export type CdfServiceErrorDetails = {
  kind: ServiceErrorKind;
  status?: number;
  requestId?: string;
  /**
   * Identifiers a bulk lookup could not resolve. These are *data*, not a
   * failure: a deep link can legitimately reference a deleted instance.
   */
  missing?: readonly object[];
  cause?: unknown;
};

/**
 * The only error type the service layer throws.
 *
 * Panels classify on `kind` and never import `@cognite/sdk` error types, so the
 * SDK stays an implementation detail of this layer.
 */
export class CdfServiceError extends Error {
  readonly kind: ServiceErrorKind;
  readonly status?: number;
  readonly requestId?: string;
  readonly missing: readonly object[];
  readonly cause: unknown;

  constructor(message: string, details: CdfServiceErrorDetails) {
    super(message);
    this.name = 'CdfServiceError';
    this.kind = details.kind;
    this.status = details.status;
    this.requestId = details.requestId;
    this.missing = details.missing ?? [];
    this.cause = details.cause;
  }
}

/** Status-first classification, per docs/cdm-traversal-notes.md §8.3. */
export function classifyStatus(status: number | undefined): ServiceErrorKind {
  if (status === undefined) return 'unknown';
  if (status === 401 || status === 403) return 'no-access';
  if (status === 408 || status === 429 || status >= 500) return 'transient';
  return 'unknown';
}

/** Normalizes anything thrown by the SDK, the network, or our own code. */
export function toCdfServiceError(error: unknown): CdfServiceError {
  if (error instanceof CdfServiceError) return error;

  if (error instanceof CogniteError) {
    return new CdfServiceError(error.errorMessage, {
      kind: classifyStatus(error.status),
      status: error.status,
      requestId: error.requestId,
      missing: error.missing,
      cause: error,
    });
  }

  if (error instanceof HttpError) {
    const body = error.data.error;
    return new CdfServiceError(body?.message ?? error.message, {
      kind: classifyStatus(error.status),
      status: error.status,
      missing: body?.missing,
      cause: error,
    });
  }

  return new CdfServiceError(error instanceof Error ? error.message : String(error), {
    kind: 'unknown',
    cause: error,
  });
}
