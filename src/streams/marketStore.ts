import { useSyncExternalStore } from 'react';
import type { MarketTick } from '@/types/broker';

/**
 * External store bridging the Web Worker ring buffer to React.
 *
 * useSyncExternalStore prevents tearing and avoids per-tick React state
 * updates. React only re-renders when a batch commits and the visible
 * slice changes.
 */

const CAPACITY = 200_000;
const buffer: MarketTick[] = new Array(CAPACITY);
let head = 0;
let count = 0;

const listeners = new Set<() => void>();

/**
 * Push a batch of ticks into the ring buffer and notify subscribers.
 * Called once per batch (every ~16ms), not per tick.
 */
export function pushBatch(ticks: MarketTick[]): void {
  for (const tick of ticks) {
    buffer[head] = tick;
    head = (head + 1) % CAPACITY;
    if (count < CAPACITY) count++;
  }

  // Notify all subscribers once per batch
  for (const cb of listeners) cb();
}

/**
 * Get a slice of ticks by index range.
 * Indices are logical (0 = oldest in buffer).
 */
export function getSlice(start: number, end: number): MarketTick[] {
  const out: MarketTick[] = [];
  for (let i = start; i < end; i++) {
    const idx = (head - count + i) % CAPACITY;
    out.push(buffer[idx]);
  }
  return out;
}

export function getCount(): number {
  return count;
}

/**
 * Subscribe to buffer changes. Returns unsubscribe function.
 */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * React hook: useSyncExternalStore adapter.
 * visibleStart/visibleEnd are controlled by the virtualization scroll position.
 */
export function useMarketSlice(visibleStart: number, visibleEnd: number): MarketTick[] {
  return useSyncExternalStore(
    subscribe,
    () => getSlice(visibleStart, visibleEnd),
    () => []
  );
}
