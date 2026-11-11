'use client';

import React, {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Star,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VirtualizedList } from '@/components/virtualization/virtualList';
import { Shell } from '@/components/layout/shell';
import { cn } from '@/components/lib/utils';
import type { WatchlistEntry } from '@/types/broker';

/**
 * Watchlist screen.
 *
 * Layered state per PLAN.md architecture:
 * - Layer 2 (cache): TanStack Query owns the watchlist cache
 * - Layer 3 (optimistic transactions): React 19 `useOptimistic` drives the
 *   UI for add/remove, while `useMutation` commits to the cache with
 *   rollback on error.
 *
 * No Zustand is used for watchlist data (theme only uses Zustand).
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WatchlistRow extends WatchlistEntry {
  price: number;
  change: number;
  changePct: number;
}

type OptimisticUpdate =
  | { type: 'add'; entry: WatchlistEntry }
  | { type: 'remove'; symbol: string };

// -----------------------------------------------------------------------------
// Query keys
// -----------------------------------------------------------------------------

const watchlistKeys = {
  all: ['watchlist'] as const,
  list: () => [...watchlistKeys.all, 'list'] as const,
};

// -----------------------------------------------------------------------------
// Mock market data (placeholder)
// -----------------------------------------------------------------------------

const DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'AMD', 'COIN'];

const WATCHLIST_SEED: WatchlistEntry[] = DEFAULT_SYMBOLS.map(
  (symbol, index) => ({ symbol, addedAt: Date.now() - index * 1000 })
);

function mockPriceFor(symbol: string): { price: number; change: number; changePct: number } {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) | 0;
  }
  const previousClose = 50 + (Math.abs(hash) % 950);
  const changePct = ((hash % 201) - 100) / 20;
  const price = Math.max(previousClose * (1 + changePct / 100), 0.01);
  const change = price - previousClose;
  return { price, change, changePct };
}

const SIMULATE_LATENCY = () => new Promise((resolve) => setTimeout(resolve, 400));

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Cell({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center', className)}>{children}</div>
  );
}

function AddSymbolDialog({
  open,
  onClose,
  onAdd,
  existingSymbols,
  isAdding,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (symbol: string) => void;
  existingSymbols: string[];
  isAdding: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const normalized = value.trim().toUpperCase();
  const isDuplicate = existingSymbols.includes(normalized);
  const isValid = normalized.length > 0 && !isDuplicate && !isAdding;

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value.toUpperCase());
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalized) {
      setError('Enter a symbol');
      return;
    }
    if (isDuplicate) {
      setError(`${normalized} is already in your watchlist`);
      return;
    }
    onAdd(normalized);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed z-[60] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-2 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-symbol-title"
      >
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle id="add-symbol-title" className="text-lg font-semibold">
              Add Symbol
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-broker-muted"
                  aria-hidden="true"
                />
                <Input
                  ref={inputRef}
                  autoFocus
                  value={value}
                  onChange={handleChange}
                  placeholder="e.g. AAPL"
                  maxLength={10}
                  className="pl-10"
                  disabled={isAdding}
                />
              </div>
              {error && (
                <p className="text-sm text-broker-red flex items-center gap-1.5">
                  <X className="h-3 w-3" aria-hidden="true" />
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isAdding}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isValid || isAdding}
                  className={cn(
                    isAdding ? 'animate-pulse opacity-80' : '',
                    'w-24 justify-center'
                  )}
                >
                  {isAdding ? 'Adding…' : 'Add'}
                </Button>
              </div>
            </form>
            <p className="text-xs text-broker-muted">
              Symbols are case-insensitive and stored in your watchlist.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------

export default function WatchlistScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const watchlistQuery = useQuery({
    queryKey: watchlistKeys.list(),
    queryFn: async () => {
      return WATCHLIST_SEED;
    },
  });

  const entries: WatchlistEntry[] = watchlistQuery.data ?? [];

  const [optimisticEntries, dispatchOptimistic] = useOptimistic<
    WatchlistEntry[],
    OptimisticUpdate
  >(
    entries,
    (current, update) => {
      switch (update.type) {
        case 'add':
          if (current.some((entry) => entry.symbol === update.entry.symbol)) {
            return current;
          }
          return [...current, update.entry];
        case 'remove':
          return current.filter((entry) => entry.symbol !== update.symbol);
      }
    }
  );

  const addOptimistic = (entry: WatchlistEntry) =>
    dispatchOptimistic({ type: 'add', entry });

  const removeOptimistic = (symbol: string) =>
    dispatchOptimistic({ type: 'remove', symbol });

  const rows: WatchlistRow[] = useMemo(
    () =>
      optimisticEntries.map((entry) => ({
        ...entry,
        ...mockPriceFor(entry.symbol),
      })),
    [optimisticEntries]
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        row.symbol.toLowerCase().includes(search.toLowerCase())
      ),
    [rows, search]
  );

  const addMutation = useMutation<WatchlistEntry, Error, WatchlistEntry, { previous?: WatchlistEntry[] | undefined }>({
    mutationFn: async (entry) => {
      await SIMULATE_LATENCY();
      return entry;
    },
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: watchlistKeys.list() });
      const previous = queryClient.setQueryData<WatchlistEntry[]>(
        watchlistKeys.list(),
        (old = []) => [...old, newEntry]
      );
      addOptimistic(newEntry);
      return { previous };
    },
    onError: (_err, newEntry, context) => {
      queryClient.setQueryData(watchlistKeys.list(), context?.previous);
      removeOptimistic(newEntry.symbol);
      toast.error(`Failed to add ${newEntry.symbol}`);
    },
  });

  const removeMutation = useMutation<string, Error, string, { previous?: WatchlistEntry[] | undefined; removedEntry?: WatchlistEntry }>({
    mutationFn: async (symbol) => {
      await SIMULATE_LATENCY();
      return symbol;
    },
    onMutate: async (symbol) => {
      await queryClient.cancelQueries({ queryKey: watchlistKeys.list() });
      const previous = queryClient.setQueryData<WatchlistEntry[]>(
        watchlistKeys.list(),
        (old = []) => old.filter((entry) => entry.symbol !== symbol)
      );
      const removedEntry = (previous ?? []).find((entry) => entry.symbol === symbol);
      removeOptimistic(symbol);
      return { previous, removedEntry };
    },
    onError: (_err, symbol, context) => {
      queryClient.setQueryData(watchlistKeys.list(), context?.previous);
      if (context?.removedEntry) {
        addOptimistic(context.removedEntry);
      }
      toast.error(`Failed to remove ${symbol}`);
    },
  });

  const handleAdd = (symbol: string) => {
    if (optimisticEntries.some((entry) => entry.symbol === symbol)) {
      return;
    }
    addMutation.mutate({ symbol, addedAt: Date.now() });
  };

  const handleRemove = (symbol: string) => {
    removeMutation.mutate(symbol);
  };

  const isEmpty = filteredRows.length === 0;
  const listHeight = 'h-[calc(100vh-336px)]';

  function renderRow(item: WatchlistRow, _index: number) {
    const isUp = item.change >= 0;
    const changeSign = isUp ? '+' : '';

    return (
      <div
        className={cn(
          'flex w-full items-center gap-3 px-4 py-1.5 group transition-colors',
          'hover:bg-broker-surface/50'
        )}
      >
        <Cell className="w-16 text-broker-text font-medium">
          {item.symbol}
        </Cell>
        <Cell className="flex-1 text-right text-broker-text font-mono text-sm">
          ${item.price.toFixed(2)}
        </Cell>
        <Cell className="w-20 text-right text-broker-text font-mono text-sm">
          {changeSign}{item.change.toFixed(2)}
        </Cell>
        <Cell className="w-20 text-right">
          <Badge
            variant={isUp ? 'success' : 'error'}
            className="text-right flex items-center justify-end gap-1"
          >
            {changeSign}{item.changePct.toFixed(2)}%
            {isUp ? (
              <TrendingUp className="ml-1 h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="ml-1 h-3 w-3" aria-hidden="true" />
            )}
          </Badge>
        </Cell>
        <Cell className="w-10">
          <Button
            variant="destructive"
            size="icon"
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              handleRemove(item.symbol);
            }}
            disabled={removeMutation.isPending}
            aria-label={`Remove ${item.symbol}`}
            title={`Remove ${item.symbol}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Cell>
      </div>
    );
  }

  return (
    <Shell>
      <div className="space-y-4">
        <Card className="w-full">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-broker-green" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-broker-text">
                  Watchlist
                </h2>
              </div>
              <p className="text-sm text-broker-muted">
                Track {entries.length} symbol{entries.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-broker-muted"
                    aria-hidden="true"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter symbols…"
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={() => setDialogOpen(true)}
                  disabled={addMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {addMutation.isPending ? 'Adding…' : 'Add Symbol'}
                  <Plus className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardContent className="p-0">
            <div className="flex items-center px-4 py-2.5 text-xs font-medium text-broker-muted border-b border-broker-surface">
              <Cell className="w-16">Symbol</Cell>
              <Cell className="flex-1 text-right">Price</Cell>
              <Cell className="w-20 text-right">Change</Cell>
              <Cell className="w-20 text-right">Change %</Cell>
              <Cell className="w-10" />
            </div>

            {isEmpty ? (
              <div
                className={cn(
                  'flex flex-col items-center justify-center text-broker-muted',
                  listHeight
                )}
              >
                <Search className="h-10 w-10 mb-2 opacity-40" aria-hidden="true" />
                <p>
                  {search
                    ? 'No symbols match your filter.'
                    : 'Your watchlist is empty. Add symbols to track prices.'}
                </p>
              </div>
            ) : (
              <div className={cn('outline-none', listHeight)}>
                <VirtualizedList
                  items={filteredRows}
                  itemHeight={48}
                  renderItem={renderRow}
                  className="focus-visible:outline-none"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <AddSymbolDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onAdd={handleAdd}
          existingSymbols={optimisticEntries.map((entry) => entry.symbol)}
          isAdding={addMutation.isPending}
        />
      </div>
    </Shell>
  );
}
