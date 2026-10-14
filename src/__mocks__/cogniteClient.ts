import type { CogniteClient } from '@cognite/sdk';
import type { Mock } from 'vitest';
import { vi } from 'vitest';

/**
 * Minimal, type-safe stand-in for `CogniteClient` covering only the surface
 * used by `src/cognite-file-viewer`: `project`, `post`, `files.retrieve`,
 * `documents.preview.pdfTemporaryLink`, and `instances.query`.
 *
 * `CogniteClient` is a large SDK class; per CLAUDE.md §7 the
 * `Partial<T> as T` pattern is used (nested, one boundary per SDK
 * sub-resource) to build a structurally valid stub without `any`.
 */
export interface CogniteClientStub {
  client: CogniteClient;
  post: Mock;
  filesRetrieve: Mock;
  pdfTemporaryLink: Mock;
  instancesQuery: Mock;
}

export function createCogniteClientStub(project = 'test-project'): CogniteClientStub {
  const post = vi.fn();
  const filesRetrieve = vi.fn();
  const pdfTemporaryLink = vi.fn();
  const instancesQuery = vi.fn();

  const files = {
    retrieve: filesRetrieve,
  } as Partial<CogniteClient['files']> as CogniteClient['files'];

  const preview = {
    pdfTemporaryLink,
  } as Partial<CogniteClient['documents']['preview']> as CogniteClient['documents']['preview'];

  const documents = {
    preview,
  } as Partial<CogniteClient['documents']> as CogniteClient['documents'];

  const instances = {
    query: instancesQuery,
  } as Partial<CogniteClient['instances']> as CogniteClient['instances'];

  const client = {
    project,
    post,
    files,
    documents,
    instances,
  } as Partial<CogniteClient> as CogniteClient;

  return { client, post, filesRetrieve, pdfTemporaryLink, instancesQuery };
}
