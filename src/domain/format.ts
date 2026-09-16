/** Shown wherever CDF holds no value, so a gap is never rendered as `0` or a blank cell. */
export const NO_VALUE = '—';

export function formatDateTime(timestamp: number | undefined): string {
  if (timestamp === undefined) {
    return NO_VALUE;
  }
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeOfDay(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

/**
 * Formats a reading. Numbers keep up to three decimals — enough for process
 * values without implying precision the source does not have.
 */
export function formatReading(value: number | string | undefined): string {
  if (value === undefined) {
    return NO_VALUE;
  }
  if (typeof value === 'string') {
    return value.length > 0 ? value : NO_VALUE;
  }
  if (!Number.isFinite(value)) {
    return NO_VALUE;
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function formatValueWithUnit(value: number | string | undefined, unit: string | undefined): string {
  const formatted = formatReading(value);
  if (formatted === NO_VALUE || unit === undefined) {
    return formatted;
  }
  return `${formatted} ${unit}`;
}

function lastSegment(value: string, separator: string): string | undefined {
  const segments = value.split(separator);
  const last = segments[segments.length - 1];
  return segments.length > 1 && last !== undefined && last.length > 0 ? last : undefined;
}

/** Turns `application/pdf` into `PDF`, `image/png` into `PNG`. */
export function formatDocumentType(mimeType: string | undefined, fileName: string | undefined): string {
  if (mimeType !== undefined) {
    const subtype = lastSegment(mimeType, '/');
    if (subtype !== undefined) {
      return subtype
        .replace(/^x-/, '')
        .replace(/^vnd\..*?([^.]+)$/, '$1')
        .toUpperCase();
    }
  }
  const extension = fileName === undefined ? undefined : lastSegment(fileName, '.');
  if (extension !== undefined) {
    return extension.toUpperCase();
  }
  return NO_VALUE;
}

/** Plain-language age of a reading, so the analyst can judge whether it is live. */
export function formatAge(timestamp: number, now: number): string {
  const deltaMs = now - timestamp;
  if (deltaMs < 0) {
    return 'just now';
  }
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
