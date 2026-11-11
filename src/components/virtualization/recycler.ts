/**
 * DOM node recycler for virtualized lists and grids.
 *
 * Instead of destroying and recreating DOM nodes as the user scrolls,
 * we recycle a fixed pool of nodes by moving them to new positions
 * and updating their content. This keeps the live DOM node count flat
 * regardless of list length — critical for 100k+ item views.
 */

interface RecycledNode {
  element: HTMLElement;
  key: string | number;
  inUse: boolean;
}

export class DOMRecycler {
  private pool: RecycledNode[] = [];
  private readonly createNode: () => HTMLElement;
  private readonly maxSize: number;

  constructor(createNode: () => HTMLElement, maxSize = 100) {
    this.createNode = createNode;
    this.maxSize = maxSize;
  }

  /**
   * Acquire a node from the pool. Creates one if pool is exhausted
   * and under maxSize.
   */
  acquire(key: string | number): HTMLElement {
    // Find unused node
    for (const node of this.pool) {
      if (!node.inUse) {
        node.inUse = true;
        node.key = key;
        return node.element;
      }
    }

    // Create new if under max
    if (this.pool.length < this.maxSize) {
      const element = this.createNode();
      this.pool.push({ element, key, inUse: true });
      return element;
    }

    // Reuse first node (LRU-ish)
    const node = this.pool[0];
    node.inUse = true;
    node.key = key;
    return node.element;
  }

  /**
   * Mark a node as released back to the pool.
   */
  release(key: string | number): void {
    const node = this.pool.find((n) => n.key === key);
    if (node) {
      node.inUse = false;
    }
  }

  releaseAll(): void {
    for (const node of this.pool) {
      node.inUse = false;
    }
  }

  get size(): number {
    return this.pool.length;
  }

  get inUseCount(): number {
    return this.pool.filter((n) => n.inUse).length;
  }
}
