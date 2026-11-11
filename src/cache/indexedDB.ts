import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { MarketTick, Order, OrderStatus, Position, WatchlistEntry } from '@/types/broker';

/**
 * IndexedDB schema for Meridian Broker.
 * All stores are namespaced to allow future microfrontend extraction.
 */
export interface BrokerDB extends DBSchema {
  ticks: {
    key: number;              // seq
    value: MarketTick;
    indexes: { 'by-symbol': string };
  };
  positions: {
    key: string;              // symbol
    value: Position;
  };
  orders: {
    key: string;              // order id
    value: Order;
    indexes: { 'by-status': OrderStatus };
  };
  watchlist: {
    key: string;              // symbol
    value: WatchlistEntry;
  };
  mutations: {
    key: string;              // clientOrderId
    value: {
      id: string;
      type: 'ack' | 'place-order' | 'cancel-order';
      payload: unknown;
      status: 'pending' | 'synced' | 'failed';
      createdAt: number;
      retryCount: number;
    };
  };
  syncMeta: {
    key: string;              // symbol
    value: { lastSyncedSeq: number; lastSyncAt: number };
  };
}

/**
 * Opens (or creates) the IndexedDB database.
 * Version 1 schema. Bump version + add upgrade logic for future migrations.
 */
export async function openBrokerDB(): Promise<IDBPDatabase<BrokerDB>> {
  return openDB<BrokerDB>('meridian-broker-db', 1, {
    upgrade(db) {
      // Ticks store: append-only, keyed by monotonic sequence
      const ticksStore = db.createObjectStore('ticks', { keyPath: 'seq' });
      ticksStore.createIndex('by-symbol', 'symbol');

      // Positions store: one entry per symbol
      db.createObjectStore('positions', { keyPath: 'symbol' });

      // Orders store: keyed by order id, indexed by status
      const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
      ordersStore.createIndex('by-status', 'status');

      // Watchlist store: user-curated symbols
      db.createObjectStore('watchlist', { keyPath: 'symbol' });

      // Mutations queue: optimistic writes awaiting sync
      db.createObjectStore('mutations', { keyPath: 'id' });

      // Sync metadata: last synced seq per symbol
      db.createObjectStore('syncMeta', { keyPath: 'key' });
    },
  });
}

/**
 * Writes a batch of ticks to IndexedDB. Capped to prevent unbounded growth.
 */
export async function writeTicks(db: IDBPDatabase<BrokerDB>, ticks: MarketTick[]): Promise<void> {
  const tx = db.transaction('ticks', 'readwrite');
  const store = tx.objectStore('ticks');

  for (const tick of ticks) {
    await store.put(tick);
  }

  // Cap tick count: delete oldest 10% when over 1M rows
  const count = await store.count();
  if (count > 1_000_000) {
    const allKeys = await store.getAllKeys();
    const toDelete = allKeys.slice(0, Math.floor(count * 0.1));
    for (const key of toDelete) {
      await store.delete(key);
    }
  }

  await tx.done;
}

/**
 * Upsert a single position.
 */
export async function upsertPosition(db: IDBPDatabase<BrokerDB>, position: Position): Promise<void> {
  const tx = db.transaction('positions', 'readwrite');
  await tx.objectStore('positions').put(position);
  await tx.done;
}

/**
 * Upsert a single order.
 */
export async function upsertOrder(db: IDBPDatabase<BrokerDB>, order: Order): Promise<void> {
  const tx = db.transaction('orders', 'readwrite');
  await tx.objectStore('orders').put(order);
  await tx.done;
}

/**
 * Get all positions.
 */
export async function getAllPositions(db: IDBPDatabase<BrokerDB>): Promise<Position[]> {
  const tx = db.transaction('positions', 'readonly');
  return tx.objectStore('positions').getAll();
}

/**
 * Get all orders.
 */
export async function getAllOrders(db: IDBPDatabase<BrokerDB>): Promise<Order[]> {
  const tx = db.transaction('orders', 'readonly');
  return tx.objectStore('orders').getAll();
}

/**
 * Get all watchlist entries.
 */
export async function getAllWatchlist(db: IDBPDatabase<BrokerDB>): Promise<WatchlistEntry[]> {
  const tx = db.transaction('watchlist', 'readonly');
  return tx.objectStore('watchlist').getAll();
}

/**
 * Queue a mutation for background sync.
 */
export async function queueMutation(db: IDBPDatabase<BrokerDB>, mutation: {
  id: string;
  type: 'ack' | 'place-order' | 'cancel-order';
  payload: unknown;
}): Promise<void> {
  const tx = db.transaction('mutations', 'readwrite');
  await tx.objectStore('mutations').add({
    ...mutation,
    status: 'pending',
    createdAt: Date.now(),
    retryCount: 0,
  });
  await tx.done;
}
