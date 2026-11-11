/**
 * Web Worker mock market data generator.
 *
 * Runs entirely off-main-thread. Generates synthetic L1 ticks, L2 order book
 * depth, and time & sales trades at configurable frequency. Pushes batches to
 * the main thread via postMessage every ~16ms (one frame).
 *
 * Zero backend required — deploys to Vercel/GitHub Pages as static files.
 */

import type { MarketTick, OrderBookLevel, TapeTrade, Side } from '@/types/broker';
import type { MainToWorker } from './messageSchema';

// Mock symbol universe
const SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMD', 'GOOGL', 'AMZN', 'META'];

// Price state per symbol (random walk)
const prices: Record<string, number> = {};
for (const sym of SYMBOLS) {
  prices[sym] = 100 + Math.random() * 200;
}

let seq = 0;
let isPaused = false;
let hz = 60; // Default 60 ticks per second
let lastEmit = 0;

// Symbol pool for generating random symbols
function randomSymbol(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

// Random walk price generator
function nextPrice(symbol: string): number {
  const change = (Math.random() - 0.5) * 2; // -1 to +1
  prices[symbol] = Math.max(1, prices[symbol] + change * 0.5);
  return Math.round(prices[symbol] * 100) / 100;
}

function generateTick(): MarketTick {
  const symbol = randomSymbol();
  const price = nextPrice(symbol);
  const spread = Math.round((Math.random() * 0.05 + 0.01) * 100) / 100;
  const bid = Math.round((price - spread / 2) * 100) / 100;
  const ask = Math.round((price + spread / 2) * 100) / 100;
  const volume = Math.floor(Math.random() * 1_000_000) + 1000;
  const change = Math.round(((price - prices[symbol]) / prices[symbol]) * 100 * 100) / 100;

  return {
    id: `${symbol}-${Date.now()}-${seq}`,
    seq: seq++,
    ts: Date.now(),
    symbol,
    bid,
    ask,
    last: price,
    volume,
    change,
    changePct: change,
    level: Math.random() > 0.9 ? 'warn' : Math.random() > 0.98 ? 'error' : 'info',
  };
}

function generateBookLevel(symbol: string, side: Side, index: number): OrderBookLevel {
  const basePrice = prices[symbol];
  const offset = side === 'buy' ? -(index + 1) * 0.05 : (index + 1) * 0.05;
  const price = Math.round((basePrice + offset) * 100) / 100;
  return {
    price,
    size: Math.floor(Math.random() * 10_000) + 100,
    orders: Math.floor(Math.random() * 50) + 1,
    side,
  };
}

function generateTapeTrade(): TapeTrade {
  const symbol = randomSymbol();
  const price = nextPrice(symbol);
  const side: Side = Math.random() > 0.5 ? 'buy' : 'sell';
  return {
    id: `trade-${seq++}`,
    symbol,
    ts: Date.now(),
    price: Math.round(price * 100) / 100,
    size: Math.floor(Math.random() * 500) + 10,
    side,
    aggressor: Math.random() > 0.5,
  };
}

/**
 * Main loop: generates batches of ticks at the configured Hz.
 * Uses setTimeout (not setInterval) to avoid drift and allow pausing.
 */
function loop(now: number): void {
  if (isPaused) {
    requestAnimationFrame(loop);
    return;
  }

  const intervalMs = 1000 / hz;
  if (now - lastEmit >= intervalMs) {
    const batchSize = Math.max(1, Math.floor(hz / 60)); // ~1 batch per frame at 60fps
    const ticks: MarketTick[] = [];
    const bookLevels: OrderBookLevel[] = [];
    const trades: TapeTrade[] = [];

    for (let i = 0; i < batchSize; i++) {
      ticks.push(generateTick());

      // Generate L2 book for a random symbol every few ticks
      if (i % 3 === 0) {
        const sym = randomSymbol();
        for (let j = 0; j < 5; j++) {
          bookLevels.push(generateBookLevel(sym, 'buy', j));
          bookLevels.push(generateBookLevel(sym, 'sell', j));
        }
      }

      // Generate tape trade occasionally
      if (i % 5 === 0) {
        trades.push(generateTapeTrade());
      }
    }

    lastEmit = now;

    // Post ticks batch
    self.postMessage({ type: 'BATCH', ticks });

    // Post book levels
    if (bookLevels.length > 0) {
      self.postMessage({ type: 'BOOK', levels: bookLevels });
    }

    // Post tape trades
    if (trades.length > 0) {
      self.postMessage({ type: 'TAPE', trades });
    }
  }

  requestAnimationFrame(loop);
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<MainToWorker>) => {
  const { type } = event.data;

  switch (type) {
    case 'SET_RATE':
      hz = Math.max(1, Math.min(event.data.hz, 1000));
      break;
    case 'PAUSE':
      isPaused = true;
      break;
    case 'RESUME':
      isPaused = false;
      break;
    case 'SUBSCRIBE':
      // Acknowledge subscription (mock — real implementation would filter)
      break;
  }
};

// Start the generation loop
requestAnimationFrame(loop);
