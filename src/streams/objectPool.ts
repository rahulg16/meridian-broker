/**
 * Object pool for telemetry tick wrappers.
 *
 * Pre-allocates reusable objects to eliminate per-tick GC pressure.
 * The pool is sized for bursts of 100k+ messages per minute.
 */

interface PooledObject {
  [key: string]: unknown;
  _inUse: boolean;
}

export class ObjectPool<T extends PooledObject> {
  private pool: T[] = [];
  private readonly factory: () => T;
  private readonly maxSize: number;

  constructor(factory: () => T, maxSize = 10_000) {
    this.factory = factory;
    this.maxSize = maxSize;
    // Pre-warm the pool
    for (let i = 0; i < Math.min(1000, maxSize); i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    // Find an unused object
    for (const obj of this.pool) {
      if (!obj._inUse) {
        obj._inUse = true;
        return obj;
      }
    }

    // Pool exhausted — grow if under max
    if (this.pool.length < this.maxSize) {
      const obj = this.factory();
      obj._inUse = true;
      this.pool.push(obj);
      return obj;
    }

    // At max — reuse the first object (LRU-ish)
    const obj = this.pool[0];
    obj._inUse = true;
    return obj;
  }

  release(obj: T): void {
    obj._inUse = false;
  }

  releaseAll(): void {
    for (const obj of this.pool) {
      obj._inUse = false;
    }
  }

  size(): number {
    return this.pool.length;
  }

  inUse(): number {
    return this.pool.filter((o) => o._inUse).length;
  }
}
