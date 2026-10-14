import { describe, expect, it } from 'vitest';

import {
  NO_VALUE,
  formatAge,
  formatDate,
  formatDateTime,
  formatDocumentType,
  formatReading,
  formatTimeOfDay,
  formatValueWithUnit,
} from './format';

const NOW = Date.parse('2026-03-10T12:00:00Z');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe(formatDateTime.name, () => {
  it('renders a placeholder rather than an epoch when the time is missing', () => {
    expect(formatDateTime(undefined)).toBe(NO_VALUE);
  });

  it('renders a timestamp as a readable date and time', () => {
    expect(formatDateTime(NOW)).toMatch(/2026/);
  });
});

describe(formatReading.name, () => {
  it('distinguishes a missing reading from zero', () => {
    expect(formatReading(undefined)).toBe(NO_VALUE);
    expect(formatReading(0)).toBe('0');
  });

  it('caps decimals so a process value stays readable', () => {
    expect(formatReading(12.3456789)).toBe('12.346');
  });

  it('passes through a string reading', () => {
    expect(formatReading('RUNNING')).toBe('RUNNING');
  });

  it('rejects an empty string and a non-finite number', () => {
    expect(formatReading('')).toBe(NO_VALUE);
    expect(formatReading(Number.NaN)).toBe(NO_VALUE);
  });
});

describe(formatValueWithUnit.name, () => {
  it('appends a unit only when one is known', () => {
    expect(formatValueWithUnit(42, 'degC')).toBe('42 degC');
    expect(formatValueWithUnit(42, undefined)).toBe('42');
  });

  it('never appends a unit to a missing value', () => {
    expect(formatValueWithUnit(undefined, 'degC')).toBe(NO_VALUE);
  });
});

describe(formatDocumentType.name, () => {
  it('shortens a MIME type to its subtype', () => {
    expect(formatDocumentType('application/pdf', 'datasheet.pdf')).toBe('PDF');
    expect(formatDocumentType('image/png', undefined)).toBe('PNG');
  });

  it('strips vendor prefixes', () => {
    expect(formatDocumentType('application/x-dwg', undefined)).toBe('DWG');
  });

  it('falls back to the file extension when there is no MIME type', () => {
    expect(formatDocumentType(undefined, 'P&ID-23-HA.dwg')).toBe('DWG');
  });

  it('reports no value when neither MIME type nor extension is available', () => {
    expect(formatDocumentType(undefined, 'README')).toBe(NO_VALUE);
    expect(formatDocumentType(undefined, undefined)).toBe(NO_VALUE);
  });
});

describe(formatAge.name, () => {
  it('describes fresh and future readings as just now', () => {
    expect(formatAge(NOW, NOW)).toBe('just now');
    expect(formatAge(NOW + MINUTE, NOW)).toBe('just now');
  });

  it('scales from minutes to hours to days', () => {
    expect(formatAge(NOW - 5 * MINUTE, NOW)).toBe('5 min ago');
    expect(formatAge(NOW - 3 * HOUR, NOW)).toBe('3 h ago');
    expect(formatAge(NOW - 24 * HOUR, NOW)).toBe('1 day ago');
    expect(formatAge(NOW - 72 * HOUR, NOW)).toBe('3 days ago');
  });
});

describe('short date formatters', () => {
  it('renders a time of day and a short date', () => {
    expect(formatTimeOfDay(NOW)).toMatch(/\d{1,2}[:.]\d{2}/);
    expect(formatDate(NOW)).toMatch(/\d/);
  });
});
