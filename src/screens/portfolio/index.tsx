'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  DollarSign,
  TrendingDown,
  TrendingUp,
  ChartBarIncreasing,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/components/lib/utils';
import { VirtualizedTable } from '@/components/virtualization/virtualTable';
import { Shell } from '@/components/layout/shell';
import type { Account, Position } from '@/types/broker';

/**
 * PortfolioScreen — Meridian Broker portfolio page.
 *
 * Layout:
 *   1. Account summary card: wallet cash, buying power, total equity,
 *      day P&L (color coded), day trade count.
 *   2. Virtualized positions table (~100 mock rows) via @tanstack/react-virtual,
 *      rendering shadcn/ui Table components inside VirtualizedTable.
 *
 * Data is fetched with TanStack Query (`useQuery`). No Zustand is used.
 */

// ---------------------------------------------------------------------------
// Mock account snapshot (matches the product spec values)
// ---------------------------------------------------------------------------

const ACCOUNT: Account = {
  userId: 'user_001',
  name: 'Alex Rivera',
  wallet: 124_582.30,
  buyingPower: 124_582.30,
  totalEquity: 150_234.50,
  dayTradeCount: 3,
};

const DAY_PNL = 1_234.56;
const DAY_PNL_PCT = 1.2;

// ---------------------------------------------------------------------------
// Mock position universe (~100 rows)
// ---------------------------------------------------------------------------

const SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC',
  'CRM', 'ADBE', 'CSCO', 'ORCL', 'IBM', 'QCOM', 'TXN', 'AVGO', 'COST', 'WMT',
  'HD', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'AXP', 'BLK',
  'SPY', 'QQQ', 'IWM', 'DIA', 'XLE', 'XLF', 'XLK', 'XLV', 'XLI', 'XLB',
  'AAL', 'DAL', 'UAL', 'BA', 'LMT', 'NKE', 'SBUX', 'MCD', 'KO', 'PEP',
  'PG', 'JNJ', 'UNH', 'PFE', 'ABBV', 'TMO', 'ABT', 'CVS', 'LLY', 'DIS',
  'CMCSA', 'VZ', 'T', 'TMUS', 'CHTR', 'F', 'GM', 'RIVN', 'LCID', 'NIO',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PXD', 'MPC', 'VLO', 'PSX', 'OKE',
  'DHR', 'VRTX', 'REGN', 'ISRG', 'GILD', 'BIIB', 'PYPL', 'SQ', 'SHOP', 'COIN',
  'PLTR', 'SNOW', 'CRWD', 'PANW', 'NET', 'ZS', 'OKTA', 'TWLO', 'NOW', 'SMCI',
];

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function mockPosition(symbol: string): Position {
  const qty = Math.floor(randomInRange(1, 500));
  const avgCost = Number(randomInRange(50, 450).toFixed(2));

  // Drift market value +/-12% from cost so the book shows both green and red P&L.
  const pnlPct = Number((randomInRange(-0.12, 0.12) * 100).toFixed(2));
  const costBasis = qty * avgCost;
  const marketValue = Number((costBasis * (1 + pnlPct / 100)).toFixed(2));
  const unrealizedPnL = Number((marketValue - costBasis).toFixed(2));

  return {
    symbol,
    qty,
    avgCost,
    marketValue,
    unrealizedPnL,
    unrealizedPnLPct: pnlPct,
  };
}

function generateMockPositions(count = 100): Position[] {
  const positions: Position[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(mockPosition(SYMBOLS[i % SYMBOLS.length]));
  }
  return positions;
}

// ---------------------------------------------------------------------------
// TanStack Query
// ---------------------------------------------------------------------------

const POSITIONS_QUERY_KEY = ['portfolio', 'positions'];

/**
 * Simulates a network fetch for positions. In production this reads through
 * the Web Worker / IndexedDB cache layer instead of hitting a REST endpoint.
 */
function fetchPositions(): Promise<Position[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(generateMockPositions(100));
    }, 300);
  });
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function usd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Presentational bits
// ---------------------------------------------------------------------------

function Stat({ icon: Icon, label, value }: {
  icon?: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-broker-muted" />}
        <span className="text-[10px] uppercase tracking-wider text-broker-muted">
          {label}
        </span>
      </div>
      <span className="text-sm font-mono font-semibold text-broker-text">
        {value}
      </span>
    </div>
  );
}

function AccountSummary({ account, dayPnl, dayPnlPct }: {
  account: Account;
  dayPnl: number;
  dayPnlPct: number;
}) {
  const isPositive = dayPnl >= 0;
  const pnlColor = isPositive ? 'text-broker-green' : 'text-broker-red';
  const PnlIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat icon={DollarSign} label="Wallet cash" value={usd(account.wallet)} />
        <Stat
          icon={Briefcase}
          label="Buying power"
          value={usd(account.buyingPower)}
        />
        <Stat
          icon={ChartBarIncreasing}
          label="Total equity"
          value={usd(account.totalEquity)}
        />
        <Stat
          icon={PnlIcon}
          label="Day P&L"
          value={(
            <>
              <span className={cn('font-mono font-semibold', pnlColor)}>
                {`+${usd(Math.abs(dayPnl))}`}
              </span>
              <span className="text-broker-muted">({pct(dayPnlPct)})</span>
            </>
          )}
        />
        <Stat
          label="Day trade count"
          value={account.dayTradeCount}
        />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortfolioScreen() {
  const { data: positions = [], isPending, error } = useQuery<Position[], Error>({
    queryKey: POSITIONS_QUERY_KEY,
    queryFn: fetchPositions,
  });

  const columns = useMemo(
    () => [
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        size: 110,
        cell: ({ value }: { value: unknown }) => (
          <span className="font-mono font-semibold text-broker-text">
            {String(value)}
          </span>
        ),
      },
      {
        accessorKey: 'qty',
        header: 'Qty',
        size: 100,
        cell: ({ value }: { value: unknown }) => (
          <span className="font-mono text-broker-text">
            {new Intl.NumberFormat('en-US').format(Math.round(Number(value)))}
          </span>
        ),
      },
      {
        accessorKey: 'avgCost',
        header: 'Avg Cost',
        size: 130,
        cell: ({ value }: { value: unknown }) => usd(Number(value)),
      },
      {
        accessorKey: 'marketValue',
        header: 'Market Value',
        size: 150,
        cell: ({ value }: { value: unknown }) => usd(Number(value)),
      },
      {
        accessorKey: 'unrealizedPnL',
        header: 'Unrealized P&L',
        size: 150,
        enableSorting: true,
        cell: ({ row }: { row: Position }) => {
          const pnl = row.unrealizedPnL;
          const isPositive = pnl >= 0;
          const PnlIcon = isPositive ? TrendingUp : TrendingDown;
          return (
            <span
              className={cn(
                'flex items-center gap-1.5 font-mono font-semibold',
                isPositive ? 'text-broker-green' : 'text-broker-red'
              )}
            >
              <PnlIcon size={11} />
              {usd(pnl)}
            </span>
          );
        },
      },
      {
        accessorKey: 'unrealizedPnLPct',
        header: 'Unrealized P&L %',
        size: 150,
        enableSorting: true,
        cell: ({ row }: { row: Position }) => {
          const p = row.unrealizedPnLPct;
          const isPositive = p >= 0;
          const PnlIcon = isPositive ? TrendingUp : TrendingDown;
          return (
            <span
              className={cn(
                'flex items-center gap-1.5 font-mono font-semibold',
                isPositive ? 'text-broker-green' : 'text-broker-red'
              )}
            >
              <PnlIcon size={11} />
              {pct(p)}
            </span>
          );
        },
      },
    ],
    []
  );

  // Query errors are surfaced inline rather than crashing the page.
  if (error) {
    return (
      <Shell>
        <Card className="mt-12">
          <CardContent className="p-8 text-center">
            <p className="text-broker-text">Unable to load positions</p>
            <p className="text-broker-muted text-sm">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ChartBarIncreasing className="h-5 w-5 text-broker-muted" />
            <h2 className="text-lg font-semibold text-broker-text">Portfolio</h2>
          </div>
          <AccountSummary
            account={ACCOUNT}
            dayPnl={DAY_PNL}
            dayPnlPct={DAY_PNL_PCT}
          />
        </section>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Positions</CardTitle>
              <Badge variant="outline">{positions.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isPending ? (
              <div className="p-8 text-center text-broker-muted">
                Loading positions…
              </div>
            ) : positions.length === 0 ? (
              <div className="p-8 text-center text-broker-muted">
                No positions
              </div>
            ) : (
              <div className="h-[70vh]">
                <VirtualizedTable<Position>
                  columns={columns}
                  data={positions}
                  rowHeight={44}
                  tableId="portfolio-positions"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
