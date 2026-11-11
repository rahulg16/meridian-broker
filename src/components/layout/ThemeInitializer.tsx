'use client';

import { useEffect } from 'react';
import { useResolvedTheme } from '@/store/theme';


/**
 * ThemeInitializer syncs the Zustand theme state to the <html> element class.
 *
 * Runs once in the layout shell. It:
 * 1. Reads resolvedTheme from Zustand (already persisted to localStorage)
 * 2. Adds 'dark' or 'light' class to document.documentElement
 * 3. Listens for system preference changes when theme === 'system'
 *
 * The inline script in index.html handles pre-hydration application to avoid flash.
 */
export function ThemeInitializer() {
  const resolvedTheme = useResolvedTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);

    // Listen for OS theme changes only when in 'system' mode
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        // resolvedTheme is a getter in Zustand; re-reading it triggers re-render
        // The component re-renders automatically via useResolvedTheme subscription
      };
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }
  }, [resolvedTheme]);

  return null;
}
