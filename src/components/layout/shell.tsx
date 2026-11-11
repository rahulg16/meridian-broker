'use client';

import React, { ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTheme } from '@/store/theme';
import { cn } from '@/components/lib/utils';
import { LayoutDashboard, Briefcase, Star, User, TrendingUp, BarChart3, Menu, X } from 'lucide-react';
import { Toaster } from 'sonner';
import { ThemeInitializer } from './ThemeInitializer';

/**
 * Shell layout wrapper shared by all pages.
 *
 * Wraps page content with the broker shell layout:
 * - Sidebar with navigation
 * - Top bar with theme toggle, wallet, sync status
 *
 * Usage: <Shell><PageContent /></Shell>
 */
export function Shell({ children }: { children: ReactNode }) {
  const routerState = useRouterState();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const navItems = [
    { href: '/', label: 'Home', icon: LayoutDashboard },
    { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
    { href: '/watchlist', label: 'Watchlist', icon: Star },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-broker-dark text-broker-text">
      <ScrollRestorationPlaceholder />
      <ThemeInitializer />
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 bg-broker-panel border-r border-broker-surface z-20 transform transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-broker-surface">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-broker-green rounded flex items-center justify-center text-broker-dark">
              <span className="text-xs font-bold">M</span>
            </div>
            <span className="font-bold text-broker-text text-sm tracking-tight">Meridian</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-broker-surface rounded text-broker-muted"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="py-4 space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = routerState.location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-broker-green/10 text-broker-green border border-broker-green/20'
                    : 'text-broker-muted hover:bg-broker-surface/50 hover:text-broker-text'
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-broker-surface">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-broker-surface border border-broker-surface flex items-center justify-center text-broker-text text-xs font-medium">
              R
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-medium text-broker-text">Rahul Gangadharan</p>
              <p className="text-xs text-broker-muted">rahul@example.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden relative ml-0 md:ml-64">
        {/* Top bar */}
        <header className="h-16 border-b border-broker-surface bg-broker-dark/80 backdrop-blur flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="md:hidden p-2 hover:bg-broker-surface rounded text-broker-muted"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:flex items-center gap-1 text-xs text-broker-muted">
              <div className="w-2 h-2 rounded-full bg-broker-green animate-pulse" />
              <span>Market Open</span>
              <span className="px-2">•</span>
              <span>ET 9:30 AM – 4:00 PM</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme toggle */}
            <button
              onClick={() => {
                const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                setTheme(next);
              }}
              className="p-2 hover:bg-broker-surface rounded text-broker-muted"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <BarChart3 size={18} />
              ) : theme === 'light' ? (
                <LayoutDashboard size={18} />
              ) : (
                <TrendingUp size={18} />
              )}
            </button>

            {/* Wallet display */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-broker-panel border border-broker-surface rounded">
              <span className="text-xs text-broker-muted">Wallet</span>
              <span className="text-sm font-mono text-broker-text">$124,582.30</span>
            </div>

            {/* Sync indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-broker-panel border border-broker-surface rounded">
              <div className="w-2 h-2 rounded-full bg-broker-green animate-pulse" />
              <span className="text-xs text-broker-text">Connected</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <Toaster position="bottom-right" richColors closeButton className="z-[100]" />
    </div>
  );
}

/**
 * Placeholder for scroll restoration. The real ScrollRestoration from
 * @tanstack/react-router requires route context, which this shell wrapper
 * doesn't have since it's not a route component. In production, ScrollRestoration
 * should be placed inside a route component that uses useMatches.
 */
function ScrollRestorationPlaceholder() {
  return null;
}
