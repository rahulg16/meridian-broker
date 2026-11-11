'use client';

import React, { useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/components/lib/utils';

/**
 * VirtualizedList — headless virtual scrolling with @tanstack/react-virtual.
 *
 * Renders only items in viewport + overscan, keeping DOM node count fixed
 * regardless of total item count.
 *
 * @param items - Array of items to render
 * @param itemHeight - Height of each item in pixels
 * @param renderItem - Callback to render each item (item, index) => ReactNode
 * @param overscan - Number of extra rows to render beyond viewport (default 3)
 * @param className - Additional container classes
 * @param maxHeight - Optional max height for the scroll container
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 3,
  className,
  maxHeight,
  ...props
}: {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  maxHeight?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      virtualizer.scrollToOffset(event.currentTarget.scrollTop);
    },
    [virtualizer]
  );

  const startIndex = virtualizer.range?.startIndex ?? 0;
  const endIndex = virtualizer.range?.endIndex ?? 0;
  const totalSize = virtualizer.getTotalSize();

  const visibleItems: Array<{ item: T; index: number }> = [];
  for (let i = startIndex; i <= endIndex; i++) {
    if (items[i] !== undefined) {
      visibleItems.push({ item: items[i], index: i });
    }
  }

  // Get virtual items for positioning
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      onScroll={onScroll}
      className={cn('overflow-y-auto scrollbar-thin', className)}
      style={{ height: '100%', maxHeight: maxHeight ? maxHeight : '100%' }}
      {...props}
    >
      <div
        style={{
          height: totalSize,
          width: '100%',
          position: 'relative',
          transform: `translateY(${virtualizer.scrollOffset ?? 0}px)`,
        }}
      >
        {visibleItems.map(({ item, index }) => {
          const virtualItem = virtualItems.find((v) => v.index === index);
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: virtualItem?.start ?? itemHeight * index,
                height: virtualItem?.size ?? itemHeight,
                width: '100%',
                left: 0,
                right: 0,
              }}
              className="flex items-center"
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
