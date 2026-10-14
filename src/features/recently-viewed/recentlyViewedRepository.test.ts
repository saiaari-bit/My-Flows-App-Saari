import { describe, expect, it } from 'vitest';

import {
  LocalStorageRecentlyViewedRepository,
  MAX_RECENTLY_VIEWED,
} from './recentlyViewedRepository';

describe(LocalStorageRecentlyViewedRepository.name, () => {
  it('records assets most-recent first using their stable identity', () => {
    const repository = makeRepository();

    repository.record(asset('A', 'Alpha'));
    const recent = repository.record(asset('B', 'Beta'));

    expect(recent.map((item) => item.externalId)).toEqual(['B', 'A']);
  });

  it('moves a reopened asset to the front without duplicating it', () => {
    const repository = makeRepository();
    repository.record(asset('A', 'Old name'));
    repository.record(asset('B', 'Beta'));

    const recent = repository.record(asset('A', 'Updated name'));

    expect(recent.map((item) => item.externalId)).toEqual(['A', 'B']);
    expect(recent[0]?.name).toBe('Updated name');
  });

  it('evicts the oldest entry when the exact retention limit is exceeded', () => {
    const repository = makeRepository();
    for (let index = 0; index <= MAX_RECENTLY_VIEWED; index += 1) {
      repository.record(asset(`A-${index}`, `Asset ${index}`));
    }

    const recent = repository.list();

    expect(recent).toHaveLength(10);
    expect(recent[0]?.externalId).toBe('A-10');
    expect(recent[9]?.externalId).toBe('A-1');
  });

  it('persists entries for a later repository instance', () => {
    const storage = new MemoryStorage();
    new LocalStorageRecentlyViewedRepository(storage, 'project-a').record(
      asset('A', 'Alpha')
    );

    const recent = new LocalStorageRecentlyViewedRepository(
      storage,
      'project-a'
    ).list();

    expect(recent).toEqual([asset('A', 'Alpha')]);
  });

  it('isolates entries by CDF project', () => {
    const storage = new MemoryStorage();
    new LocalStorageRecentlyViewedRepository(storage, 'project-a').record(
      asset('A', 'Alpha')
    );

    expect(
      new LocalStorageRecentlyViewedRepository(storage, 'project-b').list()
    ).toEqual([]);
  });

  it('ignores malformed stored JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem('asset-360:recently-viewed:project-a', '{not-json');

    const repository = new LocalStorageRecentlyViewedRepository(
      storage,
      'project-a'
    );

    expect(repository.list()).toEqual([]);
    expect(repository.record(asset('A', 'Alpha'))).toEqual([
      asset('A', 'Alpha'),
    ]);
  });

  it('continues to work in memory when localStorage is unavailable', () => {
    const repository = new LocalStorageRecentlyViewedRepository(
      new UnavailableStorage(),
      'project-a'
    );

    repository.record(asset('A', 'Alpha'));
    repository.record(asset('B', 'Beta'));

    expect(repository.list().map((item) => item.externalId)).toEqual(['B', 'A']);
    expect(() => repository.remove(asset('A', 'Alpha'))).not.toThrow();
  });
});

function asset(externalId: string, name: string) {
  return { space: 'my-space', externalId, name };
}

function makeRepository() {
  return new LocalStorageRecentlyViewedRepository(
    new MemoryStorage(),
    'project-a'
  );
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class UnavailableStorage implements Storage {
  get length(): number {
    throw new Error('Storage unavailable');
  }

  clear(): void {
    throw new Error('Storage unavailable');
  }

  getItem(_key: string): string | null {
    throw new Error('Storage unavailable');
  }

  key(_index: number): string | null {
    throw new Error('Storage unavailable');
  }

  removeItem(_key: string): void {
    throw new Error('Storage unavailable');
  }

  setItem(_key: string, _value: string): void {
    throw new Error('Storage unavailable');
  }
}
