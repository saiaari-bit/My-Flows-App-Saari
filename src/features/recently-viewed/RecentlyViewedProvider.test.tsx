import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { RecentlyViewedProvider } from './RecentlyViewedProvider';
import { LocalStorageRecentlyViewedRepository } from './recentlyViewedRepository';
import { useRecentlyViewed } from './useRecentlyViewed';

describe(RecentlyViewedProvider.name, () => {
  it('restores persisted entries when the provider remounts', () => {
    const storage = new MemoryStorage();
    const first = renderHook(() => useRecentlyViewed(), {
      wrapper: wrapperWith(
        new LocalStorageRecentlyViewedRepository(storage, 'project-a')
      ),
    });
    act(() =>
      first.result.current.record({
        space: 'my-space',
        externalId: 'PUMP-001',
        name: 'Feed water pump',
      })
    );
    first.unmount();

    const second = renderHook(() => useRecentlyViewed(), {
      wrapper: wrapperWith(
        new LocalStorageRecentlyViewedRepository(storage, 'project-a')
      ),
    });

    expect(second.result.current.assets).toEqual([
      {
        space: 'my-space',
        externalId: 'PUMP-001',
        name: 'Feed water pump',
      },
    ]);
  });
});

function wrapperWith(repository: LocalStorageRecentlyViewedRepository) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RecentlyViewedProvider repository={repository}>
        {children}
      </RecentlyViewedProvider>
    );
  };
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
