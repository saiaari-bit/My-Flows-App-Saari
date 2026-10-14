import type { InstanceRef } from '@/host/hostState';
import type { Asset } from '@/services/assetService';

export const MAX_RECENTLY_VIEWED = 10;
const STORAGE_PREFIX = 'asset-360:recently-viewed';

export type RecentlyViewedAsset = {
  space: string;
  externalId: string;
  name?: string;
  description?: string;
};

export interface RecentlyViewedRepository {
  list(): RecentlyViewedAsset[];
  record(asset: Asset): RecentlyViewedAsset[];
  remove(asset: InstanceRef): RecentlyViewedAsset[];
}

export class LocalStorageRecentlyViewedRepository
  implements RecentlyViewedRepository
{
  private fallback: RecentlyViewedAsset[] = [];
  private readonly key: string;

  constructor(
    private readonly storage: Storage | null,
    project: string
  ) {
    this.key = `${STORAGE_PREFIX}:${encodeURIComponent(project)}`;
  }

  list(): RecentlyViewedAsset[] {
    if (this.storage === null) return this.fallback;
    try {
      const serialized = this.storage.getItem(this.key);
      if (serialized === null) return this.fallback;
      const parsed: unknown = JSON.parse(serialized);
      this.fallback = parseRecentlyViewed(parsed);
      return this.fallback;
    } catch {
      return this.fallback;
    }
  }

  record(asset: Asset): RecentlyViewedAsset[] {
    const entry = toRecentlyViewedAsset(asset);
    const remaining = this.list().filter(
      (candidate) => !sameAsset(candidate, entry)
    );
    return this.persist([entry, ...remaining].slice(0, MAX_RECENTLY_VIEWED));
  }

  remove(asset: InstanceRef): RecentlyViewedAsset[] {
    return this.persist(
      this.list().filter((candidate) => !sameAsset(candidate, asset))
    );
  }

  private persist(entries: RecentlyViewedAsset[]): RecentlyViewedAsset[] {
    this.fallback = entries;
    if (this.storage !== null) {
      try {
        this.storage.setItem(this.key, JSON.stringify(entries));
      } catch {
        // The in-memory fallback keeps the current session usable.
      }
    }
    return entries;
  }
}

export function getBrowserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parseRecentlyViewed(value: unknown): RecentlyViewedAsset[] {
  if (!Array.isArray(value)) return [];
  const parsed: RecentlyViewedAsset[] = [];
  for (const candidate of value) {
    const entry = parseEntry(candidate);
    if (
      entry !== undefined &&
      !parsed.some((existing) => sameAsset(existing, entry))
    ) {
      parsed.push(entry);
    }
    if (parsed.length === MAX_RECENTLY_VIEWED) break;
  }
  return parsed;
}

function parseEntry(value: unknown): RecentlyViewedAsset | undefined {
  if (!isRecord(value)) return undefined;
  const { space, externalId, name, description } = value;
  if (typeof space !== 'string' || typeof externalId !== 'string') {
    return undefined;
  }
  return {
    space,
    externalId,
    ...(typeof name === 'string' ? { name } : {}),
    ...(typeof description === 'string' ? { description } : {}),
  };
}

function toRecentlyViewedAsset(asset: Asset): RecentlyViewedAsset {
  return {
    space: asset.space,
    externalId: asset.externalId,
    ...(asset.name === undefined ? {} : { name: asset.name }),
    ...(asset.description === undefined
      ? {}
      : { description: asset.description }),
  };
}

function sameAsset(left: InstanceRef, right: InstanceRef): boolean {
  return left.space === right.space && left.externalId === right.externalId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
