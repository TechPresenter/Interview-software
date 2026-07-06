'use client';

import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  /** Custom cell renderer; defaults to row[key]. */
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  page?: number;
  pages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

/** Glassmorphic, responsive data table with skeleton loading + pagination. */
export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  loading,
  emptyText = 'No records found',
  rowKey,
  onRowClick,
  page = 1,
  pages = 1,
  total,
  onPageChange,
}: DataTableProps<T>) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} className={cn('px-5 py-3 font-medium', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-5 py-4">
                      <div className="skeleton h-4 w-24" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6">
                  <EmptyState title={emptyText} className="border-0 bg-transparent py-10" />
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row) : i}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border/50 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-muted/30',
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-5 py-4', c.className)}>
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {pages}
            {typeof total === 'number' && ` · ${total} total`}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="rounded-lg border border-border px-3 py-1.5 transition enabled:hover:bg-muted/40 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= pages}
              onClick={() => onPageChange?.(page + 1)}
              className="rounded-lg border border-border px-3 py-1.5 transition enabled:hover:bg-muted/40 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
