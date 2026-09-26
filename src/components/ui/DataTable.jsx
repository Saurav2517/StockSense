import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { classNames } from '../../utils/format';
import { EmptyState, ErrorState, LoadingBlock } from './Feedback';
import { Button } from './Button';

/**
 * Reusable table with loading / error / empty states and client-side paging.
 * columns: [{ key, header, render?(row), className?, align?: 'right'|'center', hideBelow?: 'sm'|'md'|'lg'|'xl' }]
 * footer: optional node rendered in a full-width <tfoot> row (only when there are rows)
 */
export function DataTable({
  columns,
  rows = [],
  rowKey = (r) => r.id,
  loading = false,
  error = null,
  onRetry,
  onRowClick,
  empty,
  pageSize = 25,
  footer,
  dense = false,
  rowClassName,
}) {
  const [rawPage, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(rawPage, pageCount - 1); // clamp when rows shrink (e.g. after filtering)

  const visible = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  const hideClass = (bp) =>
    bp === 'sm' ? 'hidden sm:table-cell' : bp === 'md' ? 'hidden md:table-cell' : bp === 'lg' ? 'hidden lg:table-cell' : bp === 'xl' ? 'hidden xl:table-cell' : '';
  const alignClass = (a) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : '');

  return (
    <div className="table-wrap">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={classNames('th', hideClass(c.hideBelow), alignClass(c.align), c.headerClassName)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <LoadingBlock />
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columns.length}>
                <ErrorState error={error} onRetry={onRetry} />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty || <EmptyState />}</td>
            </tr>
          ) : (
            visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={classNames(
                  onRowClick && 'cursor-pointer hover:bg-brand-50/50',
                  loading && 'opacity-60',
                  typeof rowClassName === 'function' ? rowClassName(row) : rowClassName
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={classNames('td', dense && 'py-2', hideClass(c.hideBelow), alignClass(c.align), c.className)}>
                    {c.render ? c.render(row) : row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && rows.length > 0 && (
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={columns.length} className="px-4 py-2">
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      {rows.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span>
            {page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {page + 1} / {pageCount}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
