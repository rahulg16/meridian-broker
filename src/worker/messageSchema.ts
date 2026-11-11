/**
 * Shared message schema between Web Worker and main thread.
 * The Worker never imports React or TanStack Query — only plain types.
 */

import type { MarketTick, OrderBookLevel, TapeTrade, ProviderHealth, Order } from '@/types/broker';

export type WorkerToMain =
  | { type: 'BATCH'; ticks: MarketTick[] }
  | { type: 'BOOK'; levels: OrderBookLevel[] }
  | { type: 'TAPE'; trades: TapeTrade[] }
  | { type: 'HEALTH'; health: ProviderHealth }
  | { type: 'FILL'; order: Order };

export type MainToWorker =
  | { type: 'SET_RATE'; hz: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SUBSCRIBE'; symbols: string[] };

export type WorkerMessage = WorkerToMain | MainToWorker;
