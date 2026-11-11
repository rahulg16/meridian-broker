import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VirtualizedList } from '@/components/virtualization/virtualList';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Monitor, TrendingUp, TrendingDown } from 'lucide-react';
import type { MarketTick } from '@/types/broker';
import { cn } from '@/components/lib/utils';
import { Shell } from '@/components/layout/shell';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/cache/queryClient';

const KNOWN_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'WMT',
  'PG', 'UNH', 'HD', 'MA', 'DIS', 'NFLX', 'ADBE', 'CRM', 'PYPL', 'INTC',
  'CMCSA', 'PFE', 'T', 'VZ', 'KO', 'PEP', 'MRK', 'ABBV', 'TMO', 'COST',
  'AVGO', 'TXN', 'QCOM', 'AMD', 'HON', 'LOW', 'AMAT', 'SBUX', 'GS', 'MS',
  'AXP', 'BKNG', 'ISRG', 'GILD', 'MDLZ', 'REGN', 'VRTX', 'CSX', 'SO', 'DUK',
  'SRE', 'AEP', 'EXC', 'XEL', 'WEC', 'FE', 'NI', 'CMS', 'AWK', 'NEE',
];

function createSeededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function generateMockStocks(count = 500): MarketTick[] {
  const random = createSeededRandom(42);
  const stocks: MarketTick[] = [];
  for (let i = 0; i < count; i++) {
    const symbol =
      i < KNOWN_SYMBOLS.length
        ? KNOWN_SYMBOLS[i]
        : `SYM${String(i).padStart(3, '0')}`;
    const changePct = Number(((random() - 0.5) * 12).toFixed(2));
    const price = Number((10 + random() * 990).toFixed(2));
    const change = Number((price * (changePct / 100)).toFixed(2));
    const volume = Math.floor(1_000_000 + random() * 99_000_000);
    stocks.push({
      id: `tick-${symbol}`,
      seq: i + 1,
      ts: Date.now(),
      symbol,
      bid: Number((price * 0.999).toFixed(2)),
      ask: Number((price * 1.001).toFixed(2)),
      last: price,
      volume,
      change,
      changePct,
      level: 'info',
    });
  }
  return stocks;
}

export const MOCK_STOCKS = generateMockStocks();

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function changeColor(changePct: number): string {
  return changePct >= 0 ? 'text-broker-green' : 'text-broker-red';
}

function changeSign(changePct: number): string {
  return changePct >= 0 ? '+' : '';
}

interface MarketStatus {
  isOpen: boolean;
  label: string;
  nextOpen: string;
}

function computeMarketStatus(): MarketStatus {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const weekday = get('weekday');
  const hour = get('hour');
  const minute = get('minute');
  const isWeekday = weekday >= 2 && weekday <= 6;
  const nowMin = hour * 60 + minute;
  const openMin = 9 * 60 + 30;
  const closeMin = 16 * 60;
  const isOpen = isWeekday && nowMin >= openMin && nowMin < closeMin;

  let nextOpen: string;
  if (isOpen) {
    nextOpen = weekday === 6 ? 'Monday 9:30 AM ET' : 'Tomorrow 9:30 AM ET';
  } else if (!isWeekday) {
    nextOpen = 'Monday 9:30 AM ET';
  } else if (nowMin < openMin) {
    nextOpen = 'Today 9:30 AM ET';
  } else {
    nextOpen = weekday === 6 ? 'Monday 9:30 AM ET' : 'Tomorrow 9:30 AM ET';
  }
  return { isOpen, label: isOpen ? 'Market Open' : 'Market Closed', nextOpen };
}

function MoverCard({
  title,
  items,
  color,
}: {
  title: string;
  items: MarketTick[];
  color: 'green' | 'red';
}) {
  const colorClass = color === 'green' ? 'text-broker-green' : 'text-broker-red';
  const Icon = color === 'green' ? TrendingUp : TrendingDown;
  return (
    <Card className="p-3">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Icon size={14} className={colorClass} />
        </div>
      </CardHeader>
      <CardContent className="p-0 pt-1">
        <div className="space-y-2">
          {items.map((stock) => (
            <div
              key={stock.symbol}
              className="flex items-center justify-between text-xs border-b border-broker-surface/40 pb-1 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-broker-text">
                  {stock.symbol}
                </span>
                <span className="text-broker-muted">{formatPrice(stock.last)}</span>
              </div>
              <span className={cn(colorClass, 'font-mono font-semibold')}>
                {changeSign(stock.changePct)}{stock.changePct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [search, setSearch] = useState('');

  const { data: stocks = [] } = useQuery<MarketTick[]>({
    queryKey: ['popularStocks'],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return MOCK_STOCKS;
    },
    initialData: MOCK_STOCKS,
  });

  const filtered = useMemo(
    () =>
      stocks.filter((stock) =>
        stock.symbol.toLowerCase().includes(search.toLowerCase())
      ),
    [stocks, search]
  );

  const gainers = useMemo(
    () => [...stocks].sort((a, b) => b.changePct - a.changePct).slice(0, 4),
    [stocks]
  );
  const losers = useMemo(
    () => [...stocks].sort((a, b) => a.changePct - b.changePct).slice(0, 4),
    [stocks]
  );

  const status = computeMarketStatus();

  const renderStockRow = (stock: MarketTick) => (
    <div
      className={cn(
        'w-full h-full flex items-center gap-3 px-3 py-1.5',
        'rounded-md border border-transparent',
        'hover:border-broker-surface/50 hover:bg-broker-surface/40',
        'transition-colors'
      )}
    >
      <span
        className={cn(
          'flex-shrink-0 w-20 h-8 rounded-md',
          'border border-broker-surface bg-broker-panel/50',
          'px-2 text-[11px] font-mono font-semibold',
          'items-center justify-center text-broker-muted'
        )}
      >
        {stock.symbol}
      </span>
      <div className="ml-2 flex items-center gap-3 text-sm font-mono">
        <span className={cn(changeColor(stock.changePct), 'font-medium')}>
          {formatPrice(stock.last)}
        </span>
        <span className={cn(changeColor(stock.changePct), 'text-xs')}>
          {stock.changePct >= 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
          {changeSign(stock.changePct)}
          {stock.changePct.toFixed(2)}%
        </span>
        <span className="text-broker-muted text-xs">
          {formatVolume(stock.volume)}
        </span>
      </div>
    </div>
  );

  return (
    <Shell>
      <QueryClientProvider client={queryClient}>
        <div className="space-y-6">
          <Card className="p-4">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-broker-muted" />
                <span className="font-semibold text-broker-text">
                  Search stocks
                </span>
              </div>
              <p className="text-broker-muted text-sm mt-1">
                Filter the popular stocks list by symbol
              </p>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <Input
                placeholder="Type a symbol (e.g. AAPL, TSLA)..."
                value={search}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setSearch(event.target.value)
                }
                className="w-80"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor size={20} className="text-broker-muted" />
                  <div>
                    <CardTitle className="text-sm">Market Status</CardTitle>
                    <p className="text-broker-muted text-xs">
                      US equities (ET)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      status.isOpen ? 'bg-broker-green' : 'bg-broker-red'
                    )}
                    aria-hidden="true"
                  />
                  <Badge
                    variant={status.isOpen ? 'success' : 'error'}
                    className="whitespace-nowrap"
                  >
                    {status.label}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="font-medium text-broker-text">
                  Next market open
                </span>
                <span className="font-mono text-broker-text">
                  {status.nextOpen}
                </span>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-broker-muted" />
                  <CardTitle className="text-sm">Popular Stocks</CardTitle>
                </div>
                <span className="text-xs text-broker-muted">
                  {filtered.length} of {stocks.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pb-0">
              <div className="border-b border-broker-surface bg-broker-surface/40">
                <div className="flex items-center w-full px-3 py-2 text-xs font-medium text-broker-muted">
                  <span className="w-20">Symbol</span>
                  <span className="ml-2">Price</span>
                  <span className="ml-4">Change</span>
                  <span className="ml-4">Volume</span>
                </div>
              </div>
              <div className="h-[560px]">
                <VirtualizedList
                  items={filtered}
                  itemHeight={48}
                  renderItem={renderStockRow}
                />
              </div>
            </CardContent>
          </Card>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Market Movers</h2>
              <p className="text-xs text-broker-muted">
                Largest intraday moves
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoverCard title="Top Gainers" items={gainers} color="green" />
              <MoverCard title="Top Losers" items={losers} color="red" />
            </div>
          </section>
        </div>
      </QueryClientProvider>
    </Shell>
  );
}