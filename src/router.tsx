import { lazy } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/cache/queryClient';

const Home = lazy(() => import('@/screens/home'));

const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Home />
    </QueryClientProvider>
  ),
});

const routeTree = createRouter({
  routeTree: rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/portfolio',
      component: () =>
        import('@/screens/portfolio').then((m) => m.default),
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/watchlist',
      component: () =>
        import('@/screens/watchlist').then((m) => m.default),
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/profile',
      component: () =>
        import('@/screens/profile').then((m) => m.default),
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/trade/$symbol',
      component: () =>
        import('@/screens/trading').then((m) => m.default),
    }),
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof routeTree;
  }
}

export const router = routeTree;
