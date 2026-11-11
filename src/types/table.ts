/**
 * Type exports for @tanstack/react-table integration.
 *
 * Centralizes column definition types so screens can import
 * consistent typing for sortable, filterable table columns.
 */

import type { ColumnDef } from '@tanstack/react-table'

export type { ColumnDef }

export type SortDirection = 'asc' | 'desc'

export interface SortableColumnMeta {
  sortable: boolean
  initialDirection?: SortDirection
}
