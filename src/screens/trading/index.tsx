'use client';

import React, {
  useMemo,
  useRef,
  useState,
  useTransition,
  useOptimistic,
} from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowUp,
  ArrowDown,
  DollarSign,
  Clock,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VirtualizedTable } from '@/components/virtualization/virtualTable';
import { VirtualizedList } from '@/components/virtualization/virtualList';
import { cn } from '@/components/lib/utils';
import type {
  Order,
  OrderStatus,
  Side,
  OrderType,
  MarketTick,
  OrderBookLevel,
  TapeTrade,
} from '@/types/broker';
import { openBrokerDB, getAllOrders, upsertOrder } from '@/cache/indexedDB';

/**
 * Trading screen for the Meridian Broker platform.
 * Route: /trade/$symbol  (param accessed via TanStack Router's useParams)
 *
 * Layout:
 * - Left column: trade ticket form + order history
 * - Right column: L2 order book (virtualized table, top) + time & sales tape (virtualized list, bottom)
 *
 * Data layer:
 * - TanStack Query (useQuery/useMutation) backed by IndexedDB for orders
 * - React 19 useOptimistic for optimistic order placement
 * - React 19 useTransition to keep the UI responsive while submitting
 *
 * No Zustand is used for data state (useThemeStore is intentionally not imported;
 * colors come from the broker Tailwind palette).
 */

// Mock wallet balance used for the pre-check (matches the shell's wallet display).
const WALLET_BALANCE = 124_582.30;

const TIF_OPTIONS = [
  { value: 'DAY', label: 'Day' },
  { value: 'GTC', label: "Good 'til canceled" },
  { value: 'IOC', label: 'Immediate or cancel' },
] as const;

const LEVELS_PER_SIDE = 10;

/**
 * Action type for the optimistic orders state.
 * 'add' inserts a placeholder order; 'remove' rolls it back when the
 * mutation settles and server data replaces it.
 */
type OrderAction =
  | { type: 'add'; order: Order }
  | { type: 'remove'; id: string };

export default function TradingPage() {
  // --- Route -----------------------------------------------------------
  const params = (useParams as any)() as { $symbol?: string };
  const symbol = (params.$symbol ?? 'AAPL').toUpperCase();

  // --- Synthetic market data -------------------------------------------
  // Deterministic mid price per symbol so the book/tape are stable per symbol.
  const currentTick: MarketTick = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < symbol.length; i++) {
      seed = (seed * 31 + symbol.charCodeAt(i)) | 0;
    }
    const mid = 100 + (Math.abs(seed) % 900); // $100 - $999
    return {
      id: `tick-${symbol}`,
      seq: 1,
      ts: Date.now(),
      symbol,
      bid: Number((mid - 0.025).toFixed(2)),
      ask: Number((mid + 0.025).toFixed(2)),
      last: mid,
      volume: 0,
      change: 0,
      changePct: 0,
      level: 'info',
    };
  }, [symbol]);

  const book = useMemo(() => {
    const mid = currentTick.last;
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    for (let i = 0; i < LEVELS_PER_SIDE; i++) {
      bids.push({
        price: Number((mid - (i + 1) * 0.05).toFixed(2)),
        size: Number(((i + 1) * 10 + 50).toFixed(2)),
        orders: 1 + (i * 3) % 12,
        side: 'buy',
      });
      asks.push({
        price: Number((mid + (i + 1) * 0.05).toFixed(2)),
        size: Number(((i + 1) * 10 + 40).toFixed(2)),
        orders: 1 + (i * 5) % 12,
        side: 'sell',
      });
    }
    return {
      bids,
      asks,
      spread: Number((asks[0].price - bids[0].price).toFixed(2)),
    };
  }, [currentTick.last]);

  const tape = useMemo(() => {
    const mid = currentTick.last;
    const trades: TapeTrade[] = [];
    for (let i = 0; i < 300; i++) {
      const side: Side = i % 2 === 0 ? 'buy' : 'sell';
      trades.push({
        id: `tape-${symbol}-${i}`,
        symbol,
        ts: Date.now() - (300 - i) * 2_500,
        price: Number((mid + (Math.sin(i) * 0.35) - 0.15).toFixed(2)),
        size: 10 * (i % 12 + 1),
        side,
        aggressor: i % 4 === 0,
      });
    }
    return trades.reverse(); // newest first
  }, [symbol, currentTick.last]);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  // --- TanStack Query: orders ------------------------------------------
  const queryClient = useQueryClient();

  const {
    data: serverOrders = [],
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['orders', symbol],
    queryFn: async () => {
      const db = await openBrokerDB();
      const all = await getAllOrders(db);
      return all
        .filter((order) => order.symbol === symbol)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
  });

  // --- React 19: optimistic orders -------------------------------------
  const [optimisticOrders, dispatchOptimistic] = useOptimistic<
    Order[],
    OrderAction
  >(
    [],
    (current, action) => {
      if (action.type === 'add') {
        return [...current, action.order];
      }
      return current.filter((order) => order.id !== action.id);
    }
  );

  // Track the latest optimistic order so it can be removed when the
  // mutation settles (the refetched server data replaces it).
  const optimisticIdRef = useRef<string | null>(null);

  const displayedOrders = useMemo(
    () => [...serverOrders, ...optimisticOrders],
    [serverOrders, optimisticOrders]
  );

  // --- TanStack Query: place order mutation ----------------------------
  const placeOrder = useMutation({
    mutationFn: async (input: {
      side: Side;
      type: OrderType;
      price: number | null;
      qty: number;
    }) => {
      // Simulate network round-trip to the execution venue.
      await new Promise((resolve) => setTimeout(resolve, 750));

      const db = await openBrokerDB();
      const order: Order = {
        id: `ord-${Date.now()}`,
        clientOrderId: `co-${Date.now()}`,
        symbol,
        side: input.side,
        type: input.type,
        price: input.price,
        qty: input.qty,
        filledQty: input.type === 'market' ? input.qty : 0,
        // Demo venue: mostly fills, occasional reject.
        status: Math.random() < 0.85 ? 'filled' : 'rejected',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await upsertOrder(db, order);
      return order;
    },
    onSuccess: (data) => {
      // Replace the optimistic placeholder with server data on next refetch.
      if (optimisticIdRef.current) {
        dispatchOptimistic({ type: 'remove', id: optimisticIdRef.current });
        optimisticIdRef.current = null;
      }
      queryClient.invalidateQueries({ queryKey: ['orders', symbol] });
      toast.success(`${data.side.toUpperCase()} ${data.qty} ${data.symbol}`, {
        description:
          data.type === 'limit'
            ? `@ $${data.price?.toFixed(2)}`
            : 'Market order',
      });
    },
    onError: () => {
      if (optimisticIdRef.current) {
        dispatchOptimistic({ type: 'remove', id: optimisticIdRef.current });
        optimisticIdRef.current = null;
      }
      toast.error('Order rejected', {
        description: 'Check price, quantity, and funds, then try again.',
      });
    },
  });

  // --- Trade ticket state ----------------------------------------------
  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [price, setPrice] = useState(String(currentTick.last));
  const [qty, setQty] = useState('10');
  const [timeInForce, setTimeInForce] = useState('DAY');

  // React 19 useTransition: keeps inputs responsive while the optimistic
  // insert and mutation are in flight.
  const [isTransitionPending, startTransition] = useTransition();

  const toggleSide = (next: Side) => setSide(next);

  const toggleType = (next: OrderType) => {
    setType(next);
    if (next === 'market') {
      setPrice(String(currentTick.last));
    }
  };

  const qtyNum = Number(qty);
  const priceNum = type === 'market' ? currentTick.last : Number(price);
  const notional = qtyNum * priceNum;
  const sufficient =
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    notional <= WALLET_BALANCE &&
    (type !== 'limit' || (Number.isFinite(priceNum) && priceNum > 0));

  const isSubmitting = placeOrder.isPending || isTransitionPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!sufficient) {
      toast.error('Insufficient funds', {
        description: `Required $${notional.toFixed(2)}, wallet $${WALLET_BALANCE.toLocaleString()}`,
      });
      return;
    }

    const optimisticOrder: Order = {
      id: `opt-${Date.now()}`,
      clientOrderId: `opt-${Date.now()}`,
      symbol,
      side,
      type,
      price: type === 'market' ? null : priceNum,
      qty: qtyNum,
      filledQty: type === 'market' ? qtyNum : 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Mark the optimistic insert as a non-urgent transition.
    startTransition(() => {
      dispatchOptimistic({ type: 'add', order: optimisticOrder });
      optimisticIdRef.current = optimisticOrder.id;
    });

    void placeOrder.mutateAsync({
      side,
      type,
      price: type === 'market' ? null : priceNum,
      qty: qtyNum,
    });
  };

  // --- Helpers ---------------------------------------------------------
  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="warn" className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            Pending
          </Badge>
        );
      case 'open':
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            Open
          </Badge>
        );
      case 'filled':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <Check className="h-3 w-3 shrink-0" />
            Filled
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <X className="h-3 w-3 shrink-0" />
            Cancelled
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="error" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Rejected
          </Badge>
        );
    }
  };

  const sideBadge = (side: Side) => (
    <Badge
      className={cn(
        side === 'buy'
          ? 'bg-broker-green/10 text-broker-green border border-broker-green/20'
          : 'bg-broker-red/10 text-broker-red border border-broker-red/20'
      )}
    >
      {side === 'buy' ? 'Buy' : 'Sell'}
    </Badge>
  );

  const makeBookColumns = (side: Side) =>
    [
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ value }: { value: number }) => (
          <span
            className={cn(
              'font-mono text-xs',
              side === 'buy' ? 'text-broker-green' : 'text-broker-red'
            )}
          >
            ${value.toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: 'size',
        header: 'Size',
        cell: ({ value }: { value: number }) => (
          <span className="font-mono text-xs text-broker-text">
            {value.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        accessorKey: 'orders',
        header: 'Orders',
        cell: ({ value }: { value: number }) => (
          <span className="text-xs text-broker-muted">
            {String(value)}
          </span>
        ),
      },
    ];

  const renderTapeItem = (trade: TapeTrade, _index: number) => (
    <div
      className={cn(
        'flex w-full items-center border-b border-broker-surface/40 last:border-0',
        trade.aggressor ? 'bg-broker-surface/30' : ''
      )}
    >
      <div className="w-16 shrink-0 font-mono text-xs text-broker-muted">
        {formatTime(trade.ts)}
      </div>
      <div className="w-22 shrink-0 font-mono text-xs text-broker-text">
        ${trade.price.toFixed(2)}
      </div>
      <div className="w-16 shrink-0 font-mono text-xs text-right">
        {trade.size.toLocaleString()}
      </div>
      <div className="ml-auto w-20 shrink-0 text-xs font-medium text-center">
        {trade.side === 'buy' ? (
          <span className="text-broker-green">▲ Buy</span>
        ) : (
          <span className="text-broker-red">▼ Sell</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:gap-6">
        {/* ============ LEFT: trade ticket + order history ============ */}
        <div className="flex-1 lg:max-w-[460px] flex flex-col gap-6">
          {/* ---------------- Trade ticket ---------------- */}
          <Card className="flex-[1.2] min-h-[360px]">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Trade Ticket
                </CardTitle>
                <CardDescription>
                  {symbol} · {currentTick.last.toLocaleString()} last
                </CardDescription>
              </div>
              <Badge className="text-xs uppercase">
                {currentTick.level}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-broker-muted uppercase font-medium">
                    Symbol
                  </label>
                  <Input defaultValue={symbol} />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-broker-muted uppercase font-medium">
                    Side
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={side === 'buy' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleSide('buy')}
                      className="flex items-center justify-center gap-2"
                    >
                      <ArrowUp size={14} className="text-broker-green shrink-0" />
                      Buy
                    </Button>
                    <Button
                      variant={side === 'sell' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => toggleSide('sell')}
                      className="flex items-center justify-center gap-2"
                    >
                      <ArrowDown size={14} className="text-broker-red shrink-0" />
                      Sell
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-broker-muted uppercase font-medium">
                    Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={type === 'market' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleType('market')}
                    >
                      Market
                    </Button>
                    <Button
                      variant={type === 'limit' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleType('limit')}
                    >
                      Limit
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-broker-muted uppercase font-medium flex items-center gap-2">
                    Price
                    <DollarSign className="h-3 w-3 shrink-0" />
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    disabled={type === 'market'}
                    placeholder={type === 'market' ? 'Market price' : '0.00'}
                  />
                  {type === 'market' && (
                    <p className="text-xs text-broker-muted">
                      Executing at market price ({currentTick.last.toFixed(2)})
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-broker-muted uppercase font-medium">
                    Quantity
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={qty}
                    onChange={(event) => setQty(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-broker-muted uppercase font-medium">
                    Time in force
                  </label>
                  <Select value={timeInForce} onValueChange={setTimeInForce}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIF_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 pt-1">
                  <Badge
                    className={cn(
                      sufficient
                        ? 'bg-broker-green/10 text-broker-green border border-broker-green/20'
                        : 'bg-broker-red/10 text-broker-red border border-broker-red/20'
                    )}
                  >
                    <AlertTriangle className="mr-1.5 h-3 w-3 shrink-0" />
                    {sufficient ? 'Sufficient funds' : 'Insufficient funds'}
                  </Badge>
                  <p className="text-xs text-broker-muted">
                    Required{' '}
                    <span className="font-mono">
                      ${notional.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    · Wallet <span className="font-mono">$ {WALLET_BALANCE.toLocaleString()}</span>
                  </p>
                </div>

                <Button
                  type="submit"
                  variant={side === 'buy' ? 'default' : 'destructive'}
                  disabled={isSubmitting || !sufficient}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? 'Placing order…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ---------------- Order history ---------------- */}
          <Card className="flex-1 min-h-[300px]">
            <CardHeader
              className="flex flex-row items-center justify-between space-y-0 pb-1"
            >
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Order History
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => refetchOrders()}>
                <RefreshCw className="h-4 w-4 shrink-0" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-18">ID</TableHead>
                    <TableHead className="w-14 text-center">Side</TableHead>
                    <TableHead className="w-14 text-center">Type</TableHead>
                    <TableHead className="w-16 text-right">Price</TableHead>
                    <TableHead className="w-16 text-right">Qty</TableHead>
                    <TableHead className="w-16 text-right">Filled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-broker-muted py-4"
                      >
                        Loading orders…
                      </TableCell>
                    </TableRow>
                  ) : displayedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-broker-muted py-4"
                      >
                        No orders yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs text-broker-muted">
                          …{order.id.slice(-6)}
                        </TableCell>
                        <TableCell className="text-center">
                          {sideBadge(order.side)}
                        </TableCell>
                        <TableCell className="text-center text-xs text-broker-muted">
                          {order.type}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {order.price === null
                            ? 'Market'
                            : `$${order.price.toFixed(2)}`}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {order.qty.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {order.filledQty.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">{renderStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-right text-xs text-broker-muted font-mono">
                          {formatTime(order.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* ============ RIGHT: order book + tape ============ */}
        <div className="flex-1 flex flex-col gap-6 h-[620px]">
          {/* ---------------- Order book L2 ---------------- */}
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-broker-green shrink-0">▲</span>{' '}
                <span className="text-broker-red shrink-0">▼</span> Order Book L2
                <span className="ml-auto text-[10px] text-broker-muted">
                  {LEVELS_PER_SIDE} levels per side
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <div className="h-full grid grid-cols-12 gap-0">
                <div className="col-span-5 h-full flex flex-col">
                  <VirtualizedTable
                    columns={makeBookColumns('buy')}
                    data={book.bids}
                    rowHeight={40}
                    className="h-full"
                  />
                </div>
                <div className="col-span-2 h-full flex flex-col items-center justify-center">
                  <div className="text-center">
                    <p className="text-[10px] text-broker-muted uppercase">
                      Spread
                    </p>
                    <p className="text-broker-text font-mono font-semibold">
                      {book.spread.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="col-span-5 h-full flex flex-col">
                  <VirtualizedTable
                    columns={makeBookColumns('sell')}
                    data={book.asks}
                    rowHeight={40}
                    className="h-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---------------- Time & Sales tape ---------------- */}
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time & Sales
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <VirtualizedList
                items={tape}
                itemHeight={32}
                renderItem={renderTapeItem}
                className="h-full"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
