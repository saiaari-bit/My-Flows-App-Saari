import { CogniteError, HttpError } from '@cognite/sdk';
import { describe, expect, it } from 'vitest';

import { CdfServiceError, classifyStatus, toCdfServiceError } from './cdfError';

describe(classifyStatus.name, () => {
  it.each([401, 403])('classifies %i as no-access', (status) => {
    expect(classifyStatus(status)).toBe('no-access');
  });

  it.each([408, 429, 500, 502, 503, 504])('classifies %i as transient', (status) => {
    expect(classifyStatus(status)).toBe('transient');
  });

  it.each([400, 404, 409, 422])('classifies %i as unknown', (status) => {
    expect(classifyStatus(status)).toBe('unknown');
  });

  it('classifies a missing status as unknown, since network failures carry none', () => {
    expect(classifyStatus(undefined)).toBe('unknown');
  });
});

describe(toCdfServiceError.name, () => {
  it('maps a CogniteError 403 to a no-access service error', () => {
    const cause = new CogniteError('Insufficient access rights', 403, 'req-1');

    const error = toCdfServiceError(cause);

    expect(error).toBeInstanceOf(CdfServiceError);
    expect(error.kind).toBe('no-access');
    expect(error.status).toBe(403);
    expect(error.requestId).toBe('req-1');
    expect(error.message).toBe('Insufficient access rights');
    expect(error.cause).toBe(cause);
  });

  it('maps a CogniteError 401 to a no-access service error', () => {
    expect(toCdfServiceError(new CogniteError('Unauthorized', 401)).kind).toBe('no-access');
  });

  it.each([408, 429, 503])('maps a CogniteError %i to a transient service error', (status) => {
    expect(toCdfServiceError(new CogniteError('Slow down', status)).kind).toBe('transient');
  });

  it('preserves missing identifiers reported by a bulk lookup as data', () => {
    const missing = [{ instanceId: { space: 'sp', externalId: 'gone' } }];
    const cause = new CogniteError('Not found', 400, undefined, { missing });

    const error = toCdfServiceError(cause);

    expect(error.missing).toEqual(missing);
  });

  it('reads the status and message out of a raw HttpError', () => {
    const cause = new HttpError(429, { error: { code: 429, message: 'Too many requests' } }, {});

    const error = toCdfServiceError(cause);

    expect(error.kind).toBe('transient');
    expect(error.status).toBe(429);
    expect(error.message).toBe('Too many requests');
  });

  it('preserves missing identifiers reported inside an HttpError envelope', () => {
    const missing = [{ externalId: 'gone' }];
    const cause = new HttpError(400, { error: { code: 400, message: 'Bad request', missing } }, {});

    expect(toCdfServiceError(cause).missing).toEqual(missing);
  });

  it('falls back to a generic error for a network failure with no status', () => {
    const error = toCdfServiceError(new TypeError('Failed to fetch'));

    expect(error.kind).toBe('unknown');
    expect(error.status).toBeUndefined();
    expect(error.message).toBe('Failed to fetch');
  });

  it('falls back to a generic error for a thrown non-error value', () => {
    const error = toCdfServiceError('boom');

    expect(error.kind).toBe('unknown');
    expect(error.message).toBe('boom');
    expect(error.cause).toBe('boom');
  });

  it('returns an already-classified service error untouched', () => {
    const original = new CdfServiceError('already mapped', { kind: 'no-access', status: 403 });

    expect(toCdfServiceError(original)).toBe(original);
  });
});

describe(CdfServiceError.name, () => {
  it('is a real Error so it survives throw/catch and instanceof narrowing', () => {
    const error = new CdfServiceError('failed', { kind: 'transient', status: 429 });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CdfServiceError');
    expect(error.missing).toEqual([]);
  });
});
