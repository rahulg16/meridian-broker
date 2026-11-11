import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query v5 client shared across the app.
 *
 * Configuration tuned for high-frequency market data:
 * - staleTime: 1s -> stream constantly refreshes the cache
 * - gcTime: 5min -> keep 5 minutes of history in memory
 * - refetchOnWindowFocus: false -> we use the Web Worker, not polling
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
