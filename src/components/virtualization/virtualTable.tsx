'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  createTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table as UI,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/lib/utils';

/**
 * VirtualizedTable — headless table with sorting + virtual scrolling.
 *
 * Combines @tanstack/react-table (sorting, column metadata) with
 * @tanstack/react-virtual (geometry, DOM recycling).
 *
 * Only viewport + overscan rows are mounted in the DOM at any time,
 * keeping the live node count flat regardless of table size.
 *
 * @param columns - Column definitions (react-table ColumnDef)
 * @param data - Row data array
 * @param rowHeight - Fixed row height in pixels (default 44)
 * @param overscan - Extra rows beyond viewport (default 3)
 * @param enableSorting - Enable click-to-sort on columns (default true)
 * @param className - Additional container classes
 * @param tableId - Optional ID for persisting sort state to localStorage
 */
export function VirtualizedTable<TData, TValue = unknown>({
  columns,
  data,
  rowHeight = 44,
  overscan = 3,
  enableSorting = true,
  className,
  tableId,
  ...props
}: {
  columns: Array<{
    accessorKey: string;
    header: string;
    size?: string | number;
    enableSorting?: boolean;
    cell?: (info: { value: TValue; row: TData }) => React.ReactNode;
  }>;
  data: TData[];
  rowHeight?: number;
  overscan?: number;
  enableSorting?: boolean;
  className?: string;
  tableId?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Persist sort state across refreshes if tableId provided
  const [userSorting, setUserSorting] = React.useState<{ id: string; desc: boolean }[]>(() => {
    if (tableId && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(`meridian-sort-${tableId}`);
        return saved ? (JSON.parse(saved) as { id: string; desc: boolean }[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  React.useEffect(() => {
    if (tableId && typeof localStorage !== 'undefined') {
      localStorage.setItem(`meridian-sort-${tableId}`, JSON.stringify(userSorting));
    }
  }, [tableId, userSorting]);

  // Build react-table column defs from our simplified column config
  const columnDefs = useMemo(
    () =>
      columns.map((col) => ({
        accessorKey: col.accessorKey,
        header: col.header,
        size: col.size,
        enableSorting: enableSorting && col.enableSorting !== false,
        cell: (info: { getValue: () => TValue; row: { original: TData } }) => {
          if (col.cell) {
            return col.cell({ value: info.getValue() as TValue, row: info.row.original });
          }
          return String(info.getValue());
        },
      })),
    [columns, enableSorting]
  );

  const table = createTable({
    columns: columnDefs as any,
    data: data as any,
    enableSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: userSorting.map((s) => ({ id: s.id, desc: s.desc })),
    },
    state: { sorting: userSorting.map((s) => ({ id: s.id, desc: s.desc })) },
    onSortingChange: (updater: any) => {
      const next = typeof updater === 'function' ? updater([]) : updater;
      setUserSorting(next);
    },
    renderFallbackValue: null,
  } as any);

  // --- React Virtual: geometry + DOM recycling ---

  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  // Reset scroll when sorted data changes
  useEffect(() => {
    virtualizer.scrollToOffset(0);
  }, [table.getRowModel().rows.length, virtualizer]);

  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      virtualizer.scrollToOffset(event.currentTarget.scrollTop);
    },
    [virtualizer]
  );

  const startIndex = virtualizer.range?.startIndex ?? 0;
  const endIndex = virtualizer.range?.endIndex ?? 0;
  const totalSize = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  const visibleRows = table.getRowModel().rows.slice(startIndex, endIndex + 1);

  return (
    <div
      ref={parentRef}
      onScroll={onScroll}
      className={cn('overflow-y-auto scrollbar-thin', className)}
      style={{ height: '100%' }}
      {...props}
    >
      <UI>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const isSorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    onClick={canSort ? () => header.column.toggleSorting() : undefined}
                    className={cn(
                      'cursor-pointer select-none',
                      isSorted === 'desc' ? 'text-broker-green' : '',
                      isSorted === 'asc' ? 'text-broker-amber' : ''
                    )}
                    style={{ width: header.column.getSize() }}
                  >
                    {String(header.column.columnDef.header ?? '')}
                    {canSort && (
                      <span className="ml-1 text-xs text-broker-muted">
                        {isSorted === 'asc' ? '▲' : isSorted === 'desc' ? '▼' : '↕'}
                      </span>
                    )}
                  </TableHead>
                );
              })}
            </tr>
          ))}
        </TableHeader>
        <TableBody>
          <colgroup>
            {table.getHeaderGroups().flatMap((hg) =>
              hg.headers.map((h, i) => (
                <col key={i} style={{ width: h.column.getSize() }} />
              ))
            )}
          </colgroup>
          {visibleRows.map((row) => {
            const index = row.index;
            const virtualItem = virtualItems.find((v) => v.index === index);
            return (
              <TableRow
                key={row.id}
                style={{
                  position: 'absolute',
                  top: virtualItem?.start ?? rowHeight * index,
                  height: virtualItem?.size ?? rowHeight,
                  left: 0,
                  right: 0,
                  width: '100%',
                }}
                className="flex flex-row"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                    {String(cell.renderValue() ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </UI>

      {/* Spacer div for scrollable area */}
      <div
        style={{
          height: totalSize,
          width: '100%',
          position: 'relative',
          transform: `translateY(${virtualizer.scrollOffset ?? 0}px)`,
        }}
      />
    </div>
  );
}
