import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Theme } from '@/types/broker';

/**
 * Zustand store for UI theme preference.
 *
 * This is the ONLY Zustand store in the app. Everything else uses
 * React 19 state, TanStack Query, or useSyncExternalStore.
 *
 * Theme is stored here because:
 * - It must persist across page refreshes (localStorage)
 * - It is read by distant components (Header, Layout, charts)
 * - It must apply before React hydration to avoid flash
 * - Zustand selectors prevent unnecessary re-renders
 */
interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;

  /**
   * Computed resolved theme. Getter, not stored value, so changing
   * OS preference doesn't trigger full-app re-renders.
   */
  get resolvedTheme(): 'light' | 'dark';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',

      setTheme: (theme) => set({ theme }),

      get resolvedTheme() {
        const { theme } = get();
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
        }
        return theme;
      },
    }),
    {
      name: 'meridian-theme-state',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * Hook that returns only the resolved theme string.
 * Components using this re-render only when resolvedTheme changes.
 */
export function useResolvedTheme(): 'light' | 'dark' {
  return useThemeStore((state) => state.resolvedTheme);
}

/**
 * Hook that returns the raw theme preference and setter.
 */
export function useTheme() {
  return {
    theme: useThemeStore((state) => state.theme),
    setTheme: useThemeStore((state) => state.setTheme),
  };
}
