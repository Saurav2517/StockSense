import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge, Badge } from '../ui/Badge';
import { EmptyState } from '../ui/Feedback';
import { formatDate } from '../../utils/format';
import { OPERATION_TYPES, operationPath } from '../../utils/operations';

const TYPE_TONES = { RECEIPT: 'emerald', DELIVERY: 'red', TRANSFER: 'sky', ADJUSTMENT: 'amber' };

/** Shared list of operations built on v_operations rows. */
export function OperationsTable({ rows, loading, error, onRetry, showType = false, empty, pageSize = 20 }) {
  const navigate = useNavigate();

  const columns = [
    {
      key: 'reference',
      header: 'Reference',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{r.reference}</span>
          {r.is_late && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600" title="Schedule date is in the past">
              <AlertTriangle className="h-3.5 w-3.5" /> Late
            </span>
          )}
        </div>
      ),
    },
    ...(showType
      ? [{ key: 'operation_type', header: 'Type', render: (r) => <Badge tone={TYPE_TONES[r.operation_type]}>{OPERATION_TYPES[r.operation_type]?.label}</Badge> }]
      : []),
    {
      key: 'contact_name',
      header: 'Contact / Note',
      hideBelow: 'md',
      render: (r) => <span className="text-slate-600">{r.contact_name || r.note || '—'}</span>,
    },
    {
      key: 'location_name',
      header: 'Location',
      hideBelow: 'sm',
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-slate-600">
          <span className="text-xs text-slate-400">{r.warehouse_code}</span> {r.location_name}
          {r.destination_location_name && (
            <>
              <ArrowRight className="h-3 w-3 text-slate-400" /> {r.destination_location_name}
            </>
          )}
        </span>
      ),
    },
    { key: 'schedule_date', header: 'Schedule', hideBelow: 'sm', render: (r) => formatDate(r.schedule_date) },
    { key: 'responsible_name', header: 'Responsible', hideBelow: 'lg', render: (r) => r.responsible_name || '—' },
    { key: 'line_count', header: 'Lines', align: 'right', hideBelow: 'lg' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.operation_type}-${r.id}`}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={(r) => navigate(operationPath(r.operation_type, r.id))}
      empty={empty || <EmptyState title="No operations found" description="Try a different filter, or create a new operation." />}
      pageSize={pageSize}
    />
  );
}
