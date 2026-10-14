import { QueryClient } from '@tanstack/react-query';

/** Isolated cache with deterministic, retry-free behavior for each unit test. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}
