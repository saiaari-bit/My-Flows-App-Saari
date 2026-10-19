import { describe, expect, it } from 'vitest';

import {
  doesDocumentPreviewApiSupportFile,
  getComputedMimeType,
  getViewerType,
  inferMimeTypeFromUrl,
  isNativelySupportedMimeType,
} from './mimeTypes';

describe(getViewerType.name, () => {
  it.each([
    ['application/pdf', 'pdf'],
    ['image/png', 'image'],
    ['image/jpeg', 'image'],
    ['image/gif', 'image'],
    ['image/webp', 'image'],
  ] as const)('maps %s to the required inline viewer', (mimeType, expected) => {
    expect(getViewerType(mimeType)).toBe(expected);
  });

  it('falls back safely for an unknown MIME type', () => {
    expect(getViewerType('application/octet-stream')).toBe('unsupported');
  });

  it('returns unsupported when the MIME type is undefined', () => {
    expect(getViewerType(undefined)).toBe('unsupported');
  });

  it.each(['text/plain', 'text/csv', 'application/json'] as const)(
    'maps %s to the text viewer',
    (mimeType) => {
      expect(getViewerType(mimeType)).toBe('text');
    }
  );

  it('canonicalises a non-standard MIME type before classifying it', () => {
    expect(getViewerType('image/jpg')).toBe('image');
    expect(getViewerType('image/tif')).toBe('image');
    expect(getViewerType('image/svg')).toBe('image');
    expect(getViewerType('application/txt')).toBe('text');
  });

  it('routes an Office document to the PDF viewer via the Document Preview API', () => {
    expect(
      getViewerType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    ).toBe('pdf');
  });
});

describe(inferMimeTypeFromUrl.name, () => {
  it('recognizes GIF filenames without reading file content', () => {
    expect(inferMimeTypeFromUrl('inspection.GIF')).toBe('image/gif');
  });

  it.each([
    ['report.pdf', 'application/pdf'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['icon.png', 'image/png'],
    ['diagram.svg', 'image/svg+xml'],
    ['scan.tif', 'image/tiff'],
    ['scan.tiff', 'image/tiff'],
    ['photo.webp', 'image/webp'],
    ['notes.txt', 'text/plain'],
    ['data.csv', 'text/csv'],
    ['data.json', 'application/json'],
  ] as const)('infers %s as %s', (name, expected) => {
    expect(inferMimeTypeFromUrl(name)).toBe(expected);
  });

  it('returns undefined for an unrecognised extension', () => {
    expect(inferMimeTypeFromUrl('archive.zip')).toBeUndefined();
  });

  it('returns undefined when there is no extension', () => {
    expect(inferMimeTypeFromUrl('README')).toBeUndefined();
  });

  it('strips query strings and hash fragments before inspecting the extension', () => {
    expect(inferMimeTypeFromUrl('https://files.example.test/a/report.pdf?token=abc#page=2')).toBe(
      'application/pdf'
    );
  });

  it('ignores a leading dot (dotfile) rather than treating it as an extension', () => {
    expect(inferMimeTypeFromUrl('.gitignore')).toBeUndefined();
  });

  it('returns undefined when the filename ends in a trailing dot', () => {
    expect(inferMimeTypeFromUrl('report.')).toBeUndefined();
  });
});

describe(isNativelySupportedMimeType.name, () => {
  it('returns true for a natively supported MIME type', () => {
    expect(isNativelySupportedMimeType('application/pdf')).toBe(true);
  });

  it('returns false for an unsupported MIME type', () => {
    expect(isNativelySupportedMimeType('application/zip')).toBe(false);
  });

  it.each([null, undefined, ''] as const)('returns false for %s', (value) => {
    expect(isNativelySupportedMimeType(value)).toBe(false);
  });
});

describe(doesDocumentPreviewApiSupportFile.name, () => {
  it('returns true when the MIME type is in the document-preview allow list', () => {
    expect(doesDocumentPreviewApiSupportFile({ mimeType: 'application/msword' })).toBe(true);
  });

  it('returns true when the file name extension is in the document-preview allow list', () => {
    expect(doesDocumentPreviewApiSupportFile({ name: 'quarterly-report.docx' })).toBe(true);
  });

  it('returns false when neither MIME type nor name match a supported Office format', () => {
    expect(
      doesDocumentPreviewApiSupportFile({ mimeType: 'application/zip', name: 'archive.zip' })
    ).toBe(false);
  });

  it('returns false when both mimeType and name are absent', () => {
    expect(doesDocumentPreviewApiSupportFile({})).toBe(false);
  });
});

describe(getComputedMimeType.name, () => {
  it('prefers and canonicalises an explicit MIME type over the file name', () => {
    expect(getComputedMimeType({ mimeType: 'image/jpg', name: 'photo.png' })).toBe('image/jpeg');
  });

  it('falls back to inferring from the file name when no MIME type is present', () => {
    expect(getComputedMimeType({ name: 'notes.txt' })).toBe('text/plain');
  });

  it('returns undefined when neither MIME type nor name is present', () => {
    expect(getComputedMimeType({})).toBeUndefined();
  });
});
