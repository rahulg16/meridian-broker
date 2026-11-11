/**
 * Core domain types for the Meridian Broker.
 * These are the shared contracts between the main thread,
 * Web Worker, IndexedDB, and TanStack Query.
 */

export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';
export type Level = 'info' | 'warn' | 'error';
export type Theme = 'light' | 'dark' | 'system';

export interface MarketTick {
  id: string;
  seq: number;          // Monotonic sequence for gap detection
  ts: number;           // Epoch ms
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  change: number;
  changePct: number;
  level: Level;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
  side: Side;
}

export interface TapeTrade {
  id: string;
  symbol: string;
  ts: number;
  price: number;
  size: number;
  side: Side;
  aggressor: boolean;
}

export interface Position {
  symbol: string;
  qty: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

export interface Order {
  id: string;
  clientOrderId: string;      // Idempotency key to prevent duplicate fills
  symbol: string;
  side: Side;
  type: OrderType;
  price: number | null;       // null for market orders
  qty: number;
  filledQty: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Account {
  userId: string;
  name: string;
  wallet: number;             // Cash available
  buyingPower: number;
  totalEquity: number;
  dayTradeCount: number;
}

export interface WatchlistEntry {
  symbol: string;
  addedAt: number;
  alerts?: Array<{
    price: number;
    direction: 'above' | 'below';
    enabled: boolean;
  }>;
}

export interface ProviderHealth {
  connected: boolean;
  latencyMs: number;
  lastError?: string;
}

// Message schema between Web Worker and main thread
export interface WorkerMessage {
  type: 'BATCH' | 'SET_RATE' | 'PAUSE' | 'RESUME' | 'HEALTH' | 'FILL';
  ticks?: MarketTick[];
  book?: OrderBookLevel[];
  tape?: TapeTrade[];
  hz?: number;
  seq?: number;
  health?: ProviderHealth;
  fill?: Order;
}
